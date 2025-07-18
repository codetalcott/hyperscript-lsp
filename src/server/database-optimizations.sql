-- Database optimizations for LLM agent fast access
-- Based on sqlite-extensions-framework patterns for agent-optimized queries

-- Pre-computed view for fast validation lookups
CREATE VIEW IF NOT EXISTS agent_validation_rules AS 
SELECT 
  f.name,
  f.syntax_canonical,
  CASE 
    WHEN f.syntax_canonical LIKE '%[%]%' THEN 'has_optional_parts'
    ELSE 'required_only'
  END as syntax_complexity,
  LENGTH(f.syntax_canonical) - LENGTH(REPLACE(f.syntax_canonical, '[', '')) as optional_count,
  LENGTH(f.syntax_canonical) - LENGTH(REPLACE(f.syntax_canonical, '<', '')) as required_count,
  f.description
FROM features f
WHERE f.name IS NOT NULL;

-- Fast lookup for common syntax patterns
CREATE VIEW IF NOT EXISTS agent_common_patterns AS
SELECT 
  ce.raw_code,
  COUNT(*) as usage_frequency,
  AVG(LENGTH(ce.raw_code)) as avg_length,
  CASE 
    WHEN ce.raw_code LIKE 'on %' THEN 'event_handler'
    WHEN ce.raw_code LIKE 'put %' THEN 'put_command'
    WHEN ce.raw_code LIKE 'toggle %' THEN 'toggle_command'
    WHEN ce.raw_code LIKE 'set %' THEN 'variable_assignment'
    ELSE 'other'
  END as pattern_type
FROM code_examples ce
WHERE LENGTH(ce.raw_code) < 100  -- Focus on simple, common patterns
GROUP BY ce.raw_code
HAVING COUNT(*) > 1  -- Only patterns that appear multiple times
ORDER BY usage_frequency DESC;

-- Pre-computed syntax requirements for fast parsing
CREATE VIEW IF NOT EXISTS agent_syntax_requirements AS
SELECT 
  f.name,
  f.syntax_canonical,
  -- Extract required parts (between < >)
  GROUP_CONCAT(
    DISTINCT CASE 
      WHEN f.syntax_canonical GLOB '*<*>*' 
      THEN REPLACE(REPLACE(
        SUBSTR(f.syntax_canonical, 
               INSTR(f.syntax_canonical, '<') + 1,
               INSTR(f.syntax_canonical, '>') - INSTR(f.syntax_canonical, '<') - 1
        ), 
        '<', ''), '>', '')
      ELSE NULL 
    END
  ) as required_parts,
  -- Extract optional parts (between [ ])  
  GROUP_CONCAT(
    DISTINCT CASE 
      WHEN f.syntax_canonical GLOB '*[*]*' 
      THEN REPLACE(REPLACE(
        SUBSTR(f.syntax_canonical,
               INSTR(f.syntax_canonical, '[') + 1, 
               INSTR(f.syntax_canonical, ']') - INSTR(f.syntax_canonical, '[') - 1
        ),
        '[', ''), ']', '')
      ELSE NULL 
    END
  ) as optional_parts
FROM features f
WHERE f.syntax_canonical IS NOT NULL;

-- Performance indexes for agent queries
CREATE INDEX IF NOT EXISTS idx_agent_fast_lookup ON features(name, syntax_canonical);
CREATE INDEX IF NOT EXISTS idx_agent_patterns ON code_examples(raw_code) 
  WHERE LENGTH(raw_code) < 100;

-- Usage statistics for confidence scoring
CREATE VIEW IF NOT EXISTS agent_usage_stats AS
SELECT 
  pattern_type,
  COUNT(*) as total_examples,
  AVG(usage_frequency) as avg_frequency,
  MIN(usage_frequency) as min_frequency,
  MAX(usage_frequency) as max_frequency
FROM agent_common_patterns
GROUP BY pattern_type;

-- Error pattern detection for validation
CREATE VIEW IF NOT EXISTS agent_error_patterns AS
SELECT 
  'missing_into' as error_type,
  'put % into %' as correct_pattern,
  'put %' as error_pattern,
  'Missing "into" keyword in put command' as error_message
UNION ALL
SELECT 
  'unmatched_quotes' as error_type,
  '% ''%'' %' as correct_pattern,
  '% ''%' as error_pattern,
  'Unmatched single quote' as error_message
UNION ALL
SELECT 
  'missing_end' as error_type,
  'if % end' as correct_pattern,
  'if %' as error_pattern,
  'Missing "end" for if statement' as error_message;

-- Cache-friendly single query for validation
CREATE VIEW IF NOT EXISTS agent_validation_cache AS
SELECT 
  f.name,
  f.syntax_canonical,
  f.description,
  avr.required_parts,
  avr.optional_parts,
  acp.usage_frequency,
  acp.pattern_type,
  CASE 
    WHEN acp.usage_frequency > 10 THEN 'high_confidence'
    WHEN acp.usage_frequency > 5 THEN 'medium_confidence' 
    ELSE 'low_confidence'
  END as confidence_level
FROM features f
LEFT JOIN agent_syntax_requirements avr ON f.name = avr.name
LEFT JOIN agent_common_patterns acp ON acp.raw_code LIKE f.name || '%'
WHERE f.name IS NOT NULL;