import { createConnection, type DatabaseConnection } from "../../db/connection";
import * as path from "node:path";
import * as fs from "node:fs/promises";

export interface ArtifactReport {
  timestamp: Date;
  duplicates: {
    commands: Array<{ name: string; count: number; ids: string[] }>;
    keywords: Array<{ name: string; count: number; ids: string[] }>;
    expressions: Array<{ name: string; count: number; ids: string[] }>;
    features: Array<{ name: string; count: number; ids: string[] }>;
    specialSymbols: Array<{ name: string; count: number; ids: string[] }>;
  };
  qualityIssues: {
    emptyDescriptions: number;
    missingSyntax: number;
    malformedJson: number;
    invalidStatus: number;
  };
  extractionArtifacts: {
    htmlTags: number;
    markdownArtifacts: number;
    encodingIssues: number;
    specialCharacters: number;
  };
  integrityIssues: {
    orphanedReferences: number;
    missingExamples: number;
    duplicateExamples: number;
    brokenLinks: number;
  };
  statistics: {
    totalRecords: number;
    totalDuplicates: number;
    storageWasted: number; // Estimated bytes
    cleanupPotential: number; // Percentage improvement
  };
  recommendations: Array<{
    type: string;
    description: string;
    severity: "critical" | "high" | "medium" | "low";
    action: string;
    estimatedImpact: string;
  }>;
}

interface DetectionConfig {
  databasePath?: string;
  includeStatistics?: boolean;
  verbose?: boolean;
}

/**
 * Detect duplicate entries in a table
 */
function detectTableDuplicates(
  conn: DatabaseConnection, 
  tableName: string, 
  nameColumn: string = 'name'
): Array<{ name: string; count: number; ids: string[] }> {
  try {
    const duplicates = conn.query(`
      SELECT ${nameColumn} as name, COUNT(*) as count, GROUP_CONCAT(id) as ids
      FROM ${tableName}
      GROUP BY ${nameColumn}
      HAVING COUNT(*) > 1
      ORDER BY count DESC
    `);
    
    return duplicates.map(row => ({
      name: row.name as string,
      count: row.count as number,
      ids: (row.ids as string).split(',')
    }));
  } catch (error) {
    console.error(`Error detecting duplicates in ${tableName}:`, error);
    return [];
  }
}

/**
 * Detect HTML and markdown artifacts in text fields
 */
function detectExtractionArtifacts(conn: DatabaseConnection): {
  htmlTags: number;
  markdownArtifacts: number;
  encodingIssues: number;
  specialCharacters: number;
} {
  const artifacts = {
    htmlTags: 0,
    markdownArtifacts: 0,
    encodingIssues: 0,
    specialCharacters: 0
  };

  const tables = ['commands', 'keywords', 'expressions', 'features', 'special_symbols'];
  
  for (const table of tables) {
    try {
      // Check for HTML tags
      const htmlResults = conn.query(`
        SELECT COUNT(*) as count FROM ${table}
        WHERE description LIKE '%<%>%' 
           OR description LIKE '%</%' 
           OR description LIKE '%&lt;%'
           OR description LIKE '%&gt;%'
           OR description LIKE '%&amp;%'
      `);
      artifacts.htmlTags += htmlResults[0]?.count as number || 0;

      // Check for markdown artifacts
      const markdownResults = conn.query(`
        SELECT COUNT(*) as count FROM ${table}
        WHERE description LIKE '%\`\`\`%'
           OR description LIKE '%**%**%'
           OR description LIKE '%##%'
           OR description LIKE '%[%](%'
      `);
      artifacts.markdownArtifacts += markdownResults[0]?.count as number || 0;

      // Check for encoding issues
      const encodingResults = conn.query(`
        SELECT COUNT(*) as count FROM ${table}
        WHERE description LIKE '%\\u%'
           OR description LIKE '%&#%'
           OR description LIKE '%\\x%'
           OR description LIKE '%\\_x%'
      `);
      artifacts.encodingIssues += encodingResults[0]?.count as number || 0;

      // Check for problematic special characters
      const specialCharResults = conn.query(`
        SELECT COUNT(*) as count FROM ${table}
        WHERE description LIKE '%\n\n\n%'
           OR description LIKE '%  %  %'
           OR description LIKE '%\t%'
           OR LENGTH(description) - LENGTH(REPLACE(description, ' ', '')) > LENGTH(description) * 0.3
      `);
      artifacts.specialCharacters += specialCharResults[0]?.count as number || 0;

    } catch (error) {
      console.error(`Error checking ${table} for artifacts:`, error);
    }
  }

  return artifacts;
}

/**
 * Detect data quality issues
 */
function detectQualityIssues(conn: DatabaseConnection): {
  emptyDescriptions: number;
  missingSyntax: number;
  malformedJson: number;
  invalidStatus: number;
} {
  const issues = {
    emptyDescriptions: 0,
    missingSyntax: 0,
    malformedJson: 0,
    invalidStatus: 0
  };

  const tables = ['commands', 'keywords', 'expressions', 'features', 'special_symbols'];
  
  for (const table of tables) {
    try {
      // Empty descriptions
      const emptyDesc = conn.query(`
        SELECT COUNT(*) as count FROM ${table}
        WHERE description IS NULL 
           OR description = '' 
           OR LENGTH(TRIM(description)) < 3
      `);
      issues.emptyDescriptions += emptyDesc[0]?.count as number || 0;

      // Missing syntax (for commands and expressions)
      if (table === 'commands') {
        const missingSyntax = conn.query(`
          SELECT COUNT(*) as count FROM ${table}
          WHERE syntax_canonical IS NULL 
             OR syntax_canonical = ''
        `);
        issues.missingSyntax += missingSyntax[0]?.count as number || 0;
      } else if (table === 'expressions') {
        const missingSyntax = conn.query(`
          SELECT COUNT(*) as count FROM ${table}
          WHERE syntax IS NULL 
             OR syntax = ''
        `);
        issues.missingSyntax += missingSyntax[0]?.count as number || 0;
      }

      // Invalid status
      const invalidStatus = conn.query(`
        SELECT COUNT(*) as count FROM ${table}
        WHERE status IS NOT NULL 
          AND status NOT IN ('Draft', 'Complete', 'Reviewed', 'Published')
      `);
      issues.invalidStatus += invalidStatus[0]?.count as number || 0;

    } catch (error) {
      console.error(`Error checking quality issues in ${table}:`, error);
    }
  }

  return issues;
}

/**
 * Detect referential integrity issues
 */
function detectIntegrityIssues(conn: DatabaseConnection): {
  orphanedReferences: number;
  missingExamples: number;
  duplicateExamples: number;
  brokenLinks: number;
} {
  const issues = {
    orphanedReferences: 0,
    missingExamples: 0,
    duplicateExamples: 0,
    brokenLinks: 0
  };

  try {
    // Orphaned code example references
    const orphanedRefs = conn.query(`
      SELECT COUNT(*) as count 
      FROM code_example_grammar_elements cege
      LEFT JOIN commands c ON cege.grammar_element_id = c.id AND cege.grammar_element_type = 'command'
      LEFT JOIN keywords k ON cege.grammar_element_id = k.id AND cege.grammar_element_type = 'keyword'
      LEFT JOIN expressions e ON cege.grammar_element_id = e.id AND cege.grammar_element_type = 'expression'
      LEFT JOIN features f ON cege.grammar_element_id = f.id AND cege.grammar_element_type = 'feature'
      LEFT JOIN special_symbols s ON cege.grammar_element_id = s.id AND cege.grammar_element_type = 'special_symbol'
      WHERE c.id IS NULL AND k.id IS NULL AND e.id IS NULL AND f.id IS NULL AND s.id IS NULL
    `);
    issues.orphanedReferences = orphanedRefs[0]?.count as number || 0;

    // Elements without examples
    const missingExamples = conn.query(`
      SELECT COUNT(*) as count FROM (
        SELECT c.id FROM commands c
        LEFT JOIN code_example_grammar_elements cege ON c.id = cege.grammar_element_id AND cege.grammar_element_type = 'command'
        WHERE cege.id IS NULL
        UNION
        SELECT k.id FROM keywords k
        LEFT JOIN code_example_grammar_elements cege ON k.id = cege.grammar_element_id AND cege.grammar_element_type = 'keyword'
        WHERE cege.id IS NULL
      )
    `);
    issues.missingExamples = missingExamples[0]?.count as number || 0;

    // Duplicate examples
    const duplicateExamples = conn.query(`
      SELECT COUNT(*) as count FROM (
        SELECT raw_code, COUNT(*) 
        FROM code_examples 
        WHERE raw_code IS NOT NULL AND LENGTH(raw_code) > 10
        GROUP BY raw_code 
        HAVING COUNT(*) > 1
      )
    `);
    issues.duplicateExamples = duplicateExamples[0]?.count as number || 0;

  } catch (error) {
    console.error("Error checking integrity issues:", error);
  }

  return issues;
}

/**
 * Calculate database statistics
 */
function calculateStatistics(
  conn: DatabaseConnection,
  duplicates: ArtifactReport['duplicates']
): {
  totalRecords: number;
  totalDuplicates: number;
  storageWasted: number;
  cleanupPotential: number;
} {
  let totalRecords = 0;
  let totalDuplicates = 0;

  const tables = ['commands', 'keywords', 'expressions', 'features', 'special_symbols'];
  
  for (const table of tables) {
    try {
      const count = conn.query(`SELECT COUNT(*) as count FROM ${table}`);
      totalRecords += count[0]?.count as number || 0;
    } catch (error) {
      console.error(`Error counting records in ${table}:`, error);
    }
  }

  // Calculate total duplicates
  Object.values(duplicates).forEach(dupeArray => {
    dupeArray.forEach(dupe => {
      totalDuplicates += dupe.count - 1; // Subtract 1 to get actual duplicate count
    });
  });

  // Estimate storage waste (rough calculation)
  const avgRecordSize = 500; // bytes
  const storageWasted = totalDuplicates * avgRecordSize;
  
  const cleanupPotential = totalRecords > 0 ? (totalDuplicates / totalRecords) * 100 : 0;

  return {
    totalRecords,
    totalDuplicates,
    storageWasted,
    cleanupPotential
  };
}

/**
 * Generate cleanup recommendations
 */
function generateRecommendations(report: Omit<ArtifactReport, 'recommendations'>): ArtifactReport['recommendations'] {
  const recommendations: ArtifactReport['recommendations'] = [];

  // Critical: Database duplicates
  const totalDuplicateTypes = Object.values(report.duplicates).filter(arr => arr.length > 0).length;
  if (totalDuplicateTypes > 0) {
    recommendations.push({
      type: "duplicates",
      description: `Found duplicates in ${totalDuplicateTypes} table types with ${report.statistics.totalDuplicates} total duplicate records`,
      severity: "critical",
      action: "Run database deduplication script to remove duplicate entries",
      estimatedImpact: `Reduce database size by ${report.statistics.cleanupPotential.toFixed(1)}% (~${Math.round(report.statistics.storageWasted / 1024)}KB)`
    });
  }

  // High: Data quality issues
  if (report.qualityIssues.emptyDescriptions > 0) {
    recommendations.push({
      type: "quality",
      description: `${report.qualityIssues.emptyDescriptions} elements have empty or inadequate descriptions`,
      severity: "high",
      action: "Review and populate missing descriptions from source documentation",
      estimatedImpact: "Improve hover documentation quality and user experience"
    });
  }

  if (report.qualityIssues.missingSyntax > 0) {
    recommendations.push({
      type: "quality",
      description: `${report.qualityIssues.missingSyntax} elements missing syntax information`,
      severity: "high",
      action: "Extract syntax patterns from documentation or examples",
      estimatedImpact: "Enable better autocompletion and validation"
    });
  }

  // Medium: Extraction artifacts
  if (report.extractionArtifacts.htmlTags > 0 || report.extractionArtifacts.markdownArtifacts > 0) {
    recommendations.push({
      type: "artifacts",
      description: `Found ${report.extractionArtifacts.htmlTags} HTML artifacts and ${report.extractionArtifacts.markdownArtifacts} markdown artifacts`,
      severity: "medium",
      action: "Clean up extraction artifacts and improve parsing logic",
      estimatedImpact: "Cleaner display text in hover documentation"
    });
  }

  // Medium: Integrity issues
  if (report.integrityIssues.orphanedReferences > 0) {
    recommendations.push({
      type: "integrity",
      description: `${report.integrityIssues.orphanedReferences} orphaned references found`,
      severity: "medium",
      action: "Clean up orphaned relationships and fix referential integrity",
      estimatedImpact: "Improve database consistency and query performance"
    });
  }

  if (report.integrityIssues.missingExamples > 0) {
    recommendations.push({
      type: "examples",
      description: `${report.integrityIssues.missingExamples} elements lack usage examples`,
      severity: "medium",
      action: "Extract more examples from cookbook and documentation",
      estimatedImpact: "Richer hover documentation with usage examples"
    });
  }

  // Low: Encoding issues
  if (report.extractionArtifacts.encodingIssues > 0) {
    recommendations.push({
      type: "encoding",
      description: `${report.extractionArtifacts.encodingIssues} potential encoding issues detected`,
      severity: "low",
      action: "Review and fix character encoding issues",
      estimatedImpact: "Prevent display issues in editor"
    });
  }

  // Sort by severity priority
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return recommendations;
}

/**
 * Main artifact detection function
 */
export async function detectDataArtifacts(config: DetectionConfig = {}): Promise<ArtifactReport> {
  const dbPath = config.databasePath || path.join(__dirname, "../../hyperscript.db");
  const conn = createConnection({ path: dbPath });

  try {
    const duplicates = {
      commands: detectTableDuplicates(conn, 'commands'),
      keywords: detectTableDuplicates(conn, 'keywords'),
      expressions: detectTableDuplicates(conn, 'expressions'),
      features: detectTableDuplicates(conn, 'features'),
      specialSymbols: detectTableDuplicates(conn, 'special_symbols', 'symbol')
    };

    const qualityIssues = detectQualityIssues(conn);
    const extractionArtifacts = detectExtractionArtifacts(conn);
    const integrityIssues = detectIntegrityIssues(conn);
    const statistics = calculateStatistics(conn, duplicates);

    const reportData = {
      timestamp: new Date(),
      duplicates,
      qualityIssues,
      extractionArtifacts,
      integrityIssues,
      statistics
    };

    const recommendations = generateRecommendations(reportData);

    const report: ArtifactReport = {
      ...reportData,
      recommendations
    };

    if (config.verbose) {
      console.log(`✅ Artifact detection completed`);
      console.log(`📊 Found ${statistics.totalDuplicates} duplicates across ${statistics.totalRecords} records`);
      console.log(`⚠️  Generated ${recommendations.length} recommendations`);
    }

    return report;

  } finally {
    conn.close();
  }
}

/**
 * CLI interface
 */
async function main() {
  console.log('🔍 Detecting data artifacts and extraction errors...');
  
  const report = await detectDataArtifacts({ verbose: true });
  
  console.log('\n===== ARTIFACT DETECTION REPORT =====');
  console.log(`Generated: ${report.timestamp.toISOString()}`);
  
  console.log('\n--- DUPLICATES ---');
  Object.entries(report.duplicates).forEach(([type, dupes]) => {
    if (dupes.length > 0) {
      console.log(`${type}: ${dupes.length} duplicate groups`);
      dupes.slice(0, 3).forEach(dupe => {
        console.log(`  - "${dupe.name}": ${dupe.count} copies`);
      });
    }
  });
  
  console.log('\n--- QUALITY ISSUES ---');
  console.log(`Empty descriptions: ${report.qualityIssues.emptyDescriptions}`);
  console.log(`Missing syntax: ${report.qualityIssues.missingSyntax}`);
  console.log(`Invalid status: ${report.qualityIssues.invalidStatus}`);
  
  console.log('\n--- EXTRACTION ARTIFACTS ---');
  console.log(`HTML tags: ${report.extractionArtifacts.htmlTags}`);
  console.log(`Markdown artifacts: ${report.extractionArtifacts.markdownArtifacts}`);
  console.log(`Encoding issues: ${report.extractionArtifacts.encodingIssues}`);
  
  console.log('\n--- INTEGRITY ISSUES ---');
  console.log(`Orphaned references: ${report.integrityIssues.orphanedReferences}`);
  console.log(`Missing examples: ${report.integrityIssues.missingExamples}`);
  console.log(`Duplicate examples: ${report.integrityIssues.duplicateExamples}`);
  
  console.log('\n--- STATISTICS ---');
  console.log(`Total records: ${report.statistics.totalRecords}`);
  console.log(`Total duplicates: ${report.statistics.totalDuplicates}`);
  console.log(`Storage wasted: ~${Math.round(report.statistics.storageWasted / 1024)}KB`);
  console.log(`Cleanup potential: ${report.statistics.cleanupPotential.toFixed(1)}%`);
  
  console.log('\n--- RECOMMENDATIONS ---');
  report.recommendations.forEach((rec, i) => {
    console.log(`${i + 1}. [${rec.severity.toUpperCase()}] ${rec.description}`);
    console.log(`   Action: ${rec.action}`);
    console.log(`   Impact: ${rec.estimatedImpact}`);
  });
  
  // Save report
  const reportPath = path.join(__dirname, '../data/artifact-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved to: ${reportPath}`);
}

if (require.main === module) {
  main().catch(console.error);
}