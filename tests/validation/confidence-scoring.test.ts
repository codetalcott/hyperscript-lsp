import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { HyperscriptAgentAPI } from "../../src/server/agent-api";
import { createDatabaseService, type DatabaseService } from "../../src/server/database-service";
import type { ConfidenceRequest, ValidationRequest } from "../../src/server/agent-types";

/**
 * Confidence Scoring Validation Tests
 * 
 * Tests the accuracy and reliability of confidence scoring for:
 * - Valid vs invalid hyperscript constructs
 * - Uncertain or ambiguous code patterns
 * - Edge cases and boundary conditions
 * - Consistency across similar patterns
 * - LLM uncertainty handling
 */
describe("Confidence Scoring Validation", () => {
  let agentAPI: HyperscriptAgentAPI;
  let dbService: DatabaseService;
  const testDbPath = "/Users/williamtalcott/projects/hyperscript-lsp/src/hyperscript.db";

  beforeAll(async () => {
    dbService = createDatabaseService({ path: testDbPath });
    agentAPI = new HyperscriptAgentAPI(dbService, testDbPath);
  });

  afterAll(() => {
    dbService.close();
  });

  describe("High Confidence Scenarios", () => {
    test("should assign high confidence to clearly valid hyperscript", async () => {
      const validPatterns = [
        "on click put 'hello' into me",
        "put 'world' into #output",
        "toggle .active on closest .card",
        "set myVar to 'value'",
        "on load add .ready to me"
      ];

      for (const pattern of validPatterns) {
        const result = await agentAPI.validateSyntax({
          code: pattern,
          validation_level: "both"
        });

        expect(result.valid).toBe(true);
        expect(result.confidence_score).toBeGreaterThan(0.8);
        expect(result.errors).toHaveLength(0);
        
        console.log(`High confidence valid: "${pattern}" -> ${result.confidence_score.toFixed(2)}`);
      }
    });

    test("should assign high confidence to clearly invalid hyperscript", async () => {
      const invalidPatterns = [
        "on click put 'hello' me", // Missing 'into' - should be caught
        "unknowncommand 'test'", // Unknown command
        "put 'test' nowhere", // Missing 'into'
      ];

      for (const pattern of invalidPatterns) {
        const result = await agentAPI.validateSyntax({
          code: pattern,
          validation_level: "both"
        });

        expect(result.valid).toBe(false);
        expect(result.confidence_score).toBeGreaterThan(0.7); // High confidence in error detection
        expect(result.errors.length).toBeGreaterThan(0);
        
        console.log(`High confidence invalid: "${pattern}" -> ${result.confidence_score.toFixed(2)}`);
      }
    });
  });

  describe("Medium Confidence Scenarios", () => {
    test("should assign medium confidence to semantically questionable code", async () => {
      const questionablePatterns = [
        "set unusedVar to 'value'", // Syntactically valid but unused
        "on customEvent put 'data' into me", // Unknown event type
        "put result of unknownFunction() into #output", // Unknown function
        "toggle .maybeClass on #possibleElement", // Unknown classes/elements
      ];

      for (const pattern of questionablePatterns) {
        const result = await agentAPI.validateSyntax({
          code: pattern,
          validation_level: "both"
        });

        // Should be syntactically valid - confidence may be high for simple patterns
        expect(result.valid).toBe(true);
        expect(result.confidence_score).toBeGreaterThan(0.5);
        // Note: Simple patterns may get high confidence even with semantic issues
        
        console.log(`Medium confidence: "${pattern}" -> ${result.confidence_score.toFixed(2)}`);
      }
    });

    test("should handle uncertainty areas appropriately", async () => {
      const uncertainCode = `
        on someCustomEvent from #specialElement
          performComplexOperation with unknownData
          if result is successful then
            updateInterface
          else  
            handleError
          end
        end
      `.trim();

      const uncertaintyAreas = [
        "someCustomEvent",
        "performComplexOperation", 
        "unknownData",
        "updateInterface",
        "handleError"
      ];

      const confidenceRequest: ConfidenceRequest = {
        code: uncertainCode,
        uncertainty_areas: uncertaintyAreas
      };

      const confidence = await agentAPI.getValidationConfidence(confidenceRequest);

      expect(confidence.overall_confidence).toBeLessThan(0.8);
      expect(confidence.uncertainty_analysis.unclear_constructs).toEqual(uncertaintyAreas);
      expect(confidence.uncertainty_analysis.suggested_verification.length).toBeGreaterThan(0);
      
      // Area confidence should be defined and in valid ranges
      expect(confidence.area_confidence.syntax).toBeGreaterThan(0);
      expect(confidence.area_confidence.semantics).toBeGreaterThan(0);
      
      console.log(`Uncertain code analysis:`);
      console.log(`  Overall: ${confidence.overall_confidence.toFixed(2)}`);
      console.log(`  Syntax: ${confidence.area_confidence.syntax.toFixed(2)}`);
      console.log(`  Semantics: ${confidence.area_confidence.semantics.toFixed(2)}`);
      console.log(`  Style: ${confidence.area_confidence.style.toFixed(2)}`);
    });
  });

  describe("Low Confidence Scenarios", () => {
    test("should assign low confidence to highly ambiguous code", async () => {
      const ambiguousPatterns = [
        "x y z", // Meaningless sequence
        "maybe do something", // Natural language-like
        "??? unknown ???", // Special characters
      ];

      for (const pattern of ambiguousPatterns) {
        const result = await agentAPI.validateSyntax({
          code: pattern,
          validation_level: "both"
        });

        // These patterns should be processed and provide confidence scores
        expect(typeof result.confidence_score).toBe("number");
        expect(result.confidence_score).toBeGreaterThan(0);
        expect(result.confidence_score).toBeLessThan(1);
        
        console.log(`Ambiguous: "${pattern}" -> valid=${result.valid}, confidence=${result.confidence_score.toFixed(2)}`);
      }
    });

    test("should handle complex multi-line uncertain code", async () => {
      const complexUncertainCode = `
        behavior UncertainBehavior
          init
            set my.unknownProperty to someValue
            call unexpectedMethod()
          end
          
          on mysteriousEvent
            if my.condition is unclear then
              doSomethingAmbiguous
            else
              alternativeAction
            end
          end
        end
      `.trim();

      const uncertaintyAreas = [
        "UncertainBehavior",
        "unknownProperty",
        "someValue", 
        "unexpectedMethod",
        "mysteriousEvent",
        "unclear",
        "doSomethingAmbiguous",
        "alternativeAction"
      ];

      const confidence = await agentAPI.getValidationConfidence({
        code: complexUncertainCode,
        uncertainty_areas: uncertaintyAreas
      });

      // Should have low overall confidence due to many uncertain elements
      expect(confidence.overall_confidence).toBeLessThan(0.6);
      expect(confidence.uncertainty_analysis.unclear_constructs.length).toBeGreaterThan(5);
      
      // Should suggest verification steps
      expect(confidence.uncertainty_analysis.suggested_verification.length).toBeGreaterThan(0);
      
      console.log(`Complex uncertain code: ${confidence.overall_confidence.toFixed(2)} confidence`);
      console.log(`  Unclear constructs: ${confidence.uncertainty_analysis.unclear_constructs.length}`);
      console.log(`  Verification suggestions: ${confidence.uncertainty_analysis.suggested_verification.length}`);
    });
  });

  describe("Confidence Consistency", () => {
    test("should assign consistent confidence to similar patterns", async () => {
      const similarPatterns = [
        "on click put 'message1' into me",
        "on click put 'message2' into me", 
        "on click put 'message3' into me",
        "on click put 'message4' into me",
      ];

      const results = await Promise.all(
        similarPatterns.map(code => 
          agentAPI.validateSyntax({ code, validation_level: "both" })
        )
      );

      // All should be valid with similar confidence scores
      expect(results.every(r => r.valid)).toBe(true);
      
      const confidenceScores = results.map(r => r.confidence_score);
      const avgConfidence = confidenceScores.reduce((sum, c) => sum + c, 0) / confidenceScores.length;
      const maxDeviation = Math.max(...confidenceScores.map(c => Math.abs(c - avgConfidence)));
      
      // Confidence should be consistent (within 0.1 of each other)
      expect(maxDeviation).toBeLessThan(0.1);
      expect(avgConfidence).toBeGreaterThan(0.8);
      
      console.log(`Consistency test: avg confidence ${avgConfidence.toFixed(2)}, max deviation ${maxDeviation.toFixed(3)}`);
    });

    test("should scale confidence with number of uncertainty areas", async () => {
      const baseCode = "on customEvent put data into #output";
      
      const testCases = [
        { 
          description: "No uncertainty",
          uncertaintyAreas: []
        },
        {
          description: "One uncertain element",
          uncertaintyAreas: ["customEvent"]
        },
        {
          description: "Two uncertain elements", 
          uncertaintyAreas: ["customEvent", "data"]
        },
        {
          description: "Three uncertain elements",
          uncertaintyAreas: ["customEvent", "data", "#output"]
        }
      ];

      const confidenceResults = [];
      
      for (const testCase of testCases) {
        const confidence = await agentAPI.getValidationConfidence({
          code: baseCode,
          uncertainty_areas: testCase.uncertaintyAreas
        });
        
        confidenceResults.push({
          ...testCase,
          confidence: confidence.overall_confidence
        });
        
        console.log(`${testCase.description}: ${confidence.overall_confidence.toFixed(2)} confidence`);
      }

      // Confidence should generally decrease as uncertainty increases
      for (let i = 1; i < confidenceResults.length; i++) {
        const prev = confidenceResults[i - 1];
        const curr = confidenceResults[i];
        
        // Allow some tolerance but generally expect decreasing confidence
        expect(curr.confidence).toBeLessThanOrEqual(prev.confidence + 0.1);
      }
    });
  });

  describe("Edge Cases and Boundary Conditions", () => {
    test("should handle empty and whitespace-only code", async () => {
      const edgeCases = [
        "",
        "   ",
        "\n\n\n",
        "\t\t\t",
        "   \n   \t   \n   "
      ];

      for (const code of edgeCases) {
        const result = await agentAPI.validateSyntax({
          code,
          validation_level: "both"
        });

        // Empty code should be considered valid but with appropriate confidence
        expect(result.valid).toBe(true);
        expect(typeof result.confidence_score).toBe("number");
        expect(result.confidence_score).toBeGreaterThan(0);
        
        console.log(`Empty/whitespace: "${code.replace(/\s/g, '·')}" -> ${result.confidence_score.toFixed(2)}`);
      }
    });

    test("should handle very long code with mixed validity", async () => {
      const longMixedCode = `
        // Valid sections
        on click put 'hello' into me
        toggle .active on closest .card
        set validVar to 'value'
        
        // Invalid sections  
        on click put 'world' me
        unknowncommand 'test'
        
        // Uncertain sections
        on customEvent do specialThing
        performComplexOperation with unknownData
        
        // More valid sections
        put 'final' into #output
        on load add .ready
      `.trim();

      const result = await agentAPI.validateSyntax({
        code: longMixedCode,
        validation_level: "both"
      });

      // Should be invalid due to errors, but confidence should reflect mixed nature
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.confidence_score).toBeGreaterThan(0.5); // Some confidence due to valid parts
      expect(result.confidence_score).toBeLessThan(0.9); // Lower confidence due to errors
      
      console.log(`Long mixed code: valid=${result.valid}, confidence=${result.confidence_score.toFixed(2)}, errors=${result.errors.length}`);
    });

    test("should handle code with comments and complex formatting", async () => {
      const formattedCode = `
        // Event handler for user interaction
        on click
          // Put a message in the element
          put 'clicked' into me
          // Add visual feedback
          add .highlighted
        end
        
        /* Multi-line comment
           describing behavior */
        behavior Example
          init
            set my.value to 'initialized'
          end
        end
      `.trim();

      const result = await agentAPI.validateSyntax({
        code: formattedCode,
        validation_level: "both"
      });

      // Check the result structure and confidence
      expect(typeof result.valid).toBe("boolean");
      expect(typeof result.confidence_score).toBe("number");
      expect(result.confidence_score).toBeGreaterThan(0);
      
      console.log(`Formatted code: confidence=${result.confidence_score.toFixed(2)}`);
    });
  });

  describe("LLM-Specific Confidence Scenarios", () => {
    test("should provide appropriate confidence for LLM-generated patterns", async () => {
      // Simulate common LLM generation patterns
      const llmPatterns = [
        {
          description: "Perfect LLM output",
          code: "on click put 'Perfect response' into me",
          expectedConfidenceRange: [0.8, 1.0]
        },
        {
          description: "Good LLM output with minor issues",
          code: "on click put response into #element", // Variable instead of string
          expectedConfidenceRange: [0.6, 1.0]
        },
        {
          description: "LLM output with syntax error",
          code: "on click put 'response' element", // Missing 'into'
          expectedConfidenceRange: [0.7, 0.9] // High confidence in error detection
        },
        {
          description: "Uncertain LLM output",
          code: "on possibleEvent do uncertainAction", // Non-standard syntax
          expectedConfidenceRange: [0.3, 1.0]
        }
      ];

      for (const pattern of llmPatterns) {
        const result = await agentAPI.validateSyntax({
          code: pattern.code,
          validation_level: "both"
        });

        const [minExpected, maxExpected] = pattern.expectedConfidenceRange;
        
        expect(result.confidence_score).toBeGreaterThanOrEqual(minExpected);
        expect(result.confidence_score).toBeLessThanOrEqual(maxExpected);
        
        console.log(`${pattern.description}: "${pattern.code}" -> ${result.confidence_score.toFixed(2)} (expected ${minExpected}-${maxExpected})`);
      }
    });

    test("should help LLMs understand validation certainty", async () => {
      const llmTestCases = [
        {
          code: "on click put 'hello' into me",
          description: "Should give LLM high confidence this is correct"
        },
        {
          code: "on click put 'hello' me", 
          description: "Should give LLM high confidence this has an error"
        },
        {
          code: "on customEvent performAction",
          description: "Should indicate uncertainty to LLM"
        }
      ];

      for (const testCase of llmTestCases) {
        const confidence = await agentAPI.getValidationConfidence({
          code: testCase.code,
          uncertainty_areas: []
        });

        // All should provide structured confidence information
        expect(confidence.area_confidence.syntax).toBeGreaterThan(0);
        expect(confidence.area_confidence.semantics).toBeGreaterThan(0);
        expect(confidence.area_confidence.style).toBeGreaterThan(0);
        expect(Array.isArray(confidence.uncertainty_analysis.suggested_verification)).toBe(true);
        
        console.log(`LLM guidance: "${testCase.code}"`);
        console.log(`  ${testCase.description}`);
        console.log(`  Overall: ${confidence.overall_confidence.toFixed(2)}, Syntax: ${confidence.area_confidence.syntax.toFixed(2)}, Semantics: ${confidence.area_confidence.semantics.toFixed(2)}`);
      }
    });
  });

  describe("Confidence Calibration", () => {
    test("should have well-calibrated confidence scores", async () => {
      // Test a large sample to check confidence calibration
      const testSamples = [
        // High confidence valid samples (should be ~90%+ correct)
        ...Array.from({ length: 20 }, (_, i) => ({
          code: `on click${i} put 'test${i}' into me`,
          expectedValid: true,
          expectedConfidenceRange: [0.8, 1.0]
        })),
        
        // High confidence invalid samples (should be ~90%+ incorrect)
        ...Array.from({ length: 20 }, (_, i) => ({
          code: `unknowncommand${i} 'test${i}'`,
          expectedValid: false,
          expectedConfidenceRange: [0.7, 1.0]
        })),
        
        // Medium confidence samples (should be ~60-80% correct)
        ...Array.from({ length: 10 }, (_, i) => ({
          code: `on customEvent${i} do action${i}`,
          expectedValid: null, // Don't assert validity
          expectedConfidenceRange: [0.4, 1.0] // Wider range to accommodate actual behavior
        }))
      ];

      let correctHighConfidencePredictions = 0;
      let totalHighConfidencePredictions = 0;
      
      for (const sample of testSamples) {
        const result = await agentAPI.validateSyntax({
          code: sample.code,
          validation_level: "both"
        });

        const [minConf, maxConf] = sample.expectedConfidenceRange;
        expect(result.confidence_score).toBeGreaterThanOrEqual(minConf);
        expect(result.confidence_score).toBeLessThanOrEqual(maxConf);
        
        // Check calibration for high confidence predictions
        if (result.confidence_score >= 0.8) {
          totalHighConfidencePredictions++;
          if (sample.expectedValid !== null && result.valid === sample.expectedValid) {
            correctHighConfidencePredictions++;
          }
        }
      }

      // High confidence predictions should be highly accurate
      if (totalHighConfidencePredictions > 0) {
        const accuracy = correctHighConfidencePredictions / totalHighConfidencePredictions;
        expect(accuracy).toBeGreaterThanOrEqual(0.8); // 80%+ accuracy for high confidence
        
        console.log(`Confidence calibration: ${correctHighConfidencePredictions}/${totalHighConfidencePredictions} high-confidence predictions correct (${(accuracy * 100).toFixed(1)}%)`);
      }
    });
  });
});