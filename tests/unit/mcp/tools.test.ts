#!/usr/bin/env bun
import { test, expect, describe } from "bun:test";
import { analyzeTool, completionTool, hoverTool, searchTool, generateTool } from '../../../mcp-server/src/tools/index.js';

describe("MCP Tools", () => {
  describe("analyze_hyperscript", () => {
    test("detects missing end statement", async () => {
      const result = await analyzeTool.execute({
        code: "on click\n  toggle .active"
      });
      
      expect(result.content[0].text).toContain("Missing 'end'");
      expect(result.content[0].text).toContain("Line 1");
    });
    
    test("passes valid code", async () => {
      const result = await analyzeTool.execute({
        code: "on click\n  toggle .active\nend"
      });
      
      expect(result.content[0].text).toContain("No syntax errors");
    });
  });
  
  describe("get_completion", () => {
    test("finds completions for partial word", async () => {
      const result = await completionTool.execute({
        code: "pu",
        line: 0,
        character: 2
      });
      
      expect(result.content[0].text).toContain("put");
    });
  });
  
  describe("get_hover_info", () => {
    test("returns info for known element", async () => {
      const result = await hoverTool.execute({
        element: "toggle"
      });
      
      expect(result.content[0].text).toContain("toggle");
      expect(result.content[0].text).toContain("command");
    });
    
    test("handles unknown element", async () => {
      const result = await hoverTool.execute({
        element: "unknownElement123"
      });
      
      expect(result.content[0].text).toContain("No information found");
    });
  });
  
  describe("search_language_elements", () => {
    test("searches across all types", async () => {
      const result = await searchTool.execute({
        query: "put"
      });
      
      expect(result.content[0].text).toContain("Search results");
      expect(result.content[0].text).toContain("Commands");
    });
    
    test("searches specific type", async () => {
      const result = await searchTool.execute({
        query: "on",
        type: "feature"
      });
      
      expect(result.content[0].text).toContain("Features");
    });
  });
  
  describe("generate_hyperscript", () => {
    test("generates event handler", async () => {
      const result = await generateTool.execute({
        pattern: "event-handler"
      });
      
      expect(result.content[0].text).toContain("on click");
      expect(result.content[0].text).toContain("end");
    });
    
    test("generates with custom options", async () => {
      const result = await generateTool.execute({
        pattern: "form-validation",
        options: { fields: ["test1", "test2"] }
      });
      
      expect(result.content[0].text).toContain("test1");
      expect(result.content[0].text).toContain("test2");
    });
  });
});