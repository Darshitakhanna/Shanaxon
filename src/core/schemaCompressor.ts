import { Tokenizer } from './tokenizer';

export interface SchemaCompressionResult {
  compressed: string;
  originalTokens: number;
  compressedTokens: number;
  savingsPct: number;
  toolCount: number;
}

/**
 * MCP Tool Schema Compressor.
 * Solves the #1 MCP complaint in 2026: "schema bloat" where connecting multiple MCP servers
 * consumes 10k–30k tokens in tool definitions alone.
 *
 * Shortens descriptions, removes redundant JSON schema metadata, and flattens nested objects.
 */
export class SchemaCompressor {
  /**
   * Main entry point: compresses an array of tool schema objects.
   */
  compress(schemas: any[]): SchemaCompressionResult {
    if (!Array.isArray(schemas)) {
      schemas = [schemas];
    }

    const toolCount = schemas.length;
    const rawJson = JSON.stringify(schemas, null, 2);
    const originalTokens = Tokenizer.countTokens(rawJson);

    const compressedSchemas = schemas.map((schema) => this.compressSingleSchema(schema));
    const compressedJson = JSON.stringify(compressedSchemas);
    const compressedTokens = Tokenizer.countTokens(compressedJson);

    const savingsPct =
      originalTokens > 0
        ? parseFloat((((originalTokens - compressedTokens) / originalTokens) * 100).toFixed(2))
        : 0;

    return {
      compressed: compressedJson,
      originalTokens,
      compressedTokens,
      savingsPct,
      toolCount,
    };
  }

  /**
   * Compresses a single tool schema definition object.
   */
  private compressSingleSchema(schema: any): any {
    if (!schema || typeof schema !== 'object') return schema;

    const copy: Record<string, any> = {};

    // Copy name
    if (schema.name) copy.name = schema.name;

    // Shorten tool description
    if (schema.description) {
      copy.description = this.shortenDescription(schema.description);
    }

    // Compress input schema
    if (schema.inputSchema) {
      copy.inputSchema = this.simplifySchemaObject(schema.inputSchema, 0);
    }

    return copy;
  }

  /**
   * Shortens a description string to first sentence, max 80 chars.
   */
  private shortenDescription(desc: string): string {
    if (!desc) return '';

    // Take first sentence
    const firstSentence = desc.split(/(?<=[.!?])\s+/)[0];
    if (firstSentence.length <= 80) {
      return firstSentence;
    }
    return `${firstSentence.substring(0, 77)}...`;
  }

  /**
   * Recursively simplifies JSON Schema properties.
   */
  private simplifySchemaObject(schemaObj: any, depth = 0): any {
    if (!schemaObj || typeof schemaObj !== 'object') return schemaObj;

    const result: Record<string, any> = {};

    if (schemaObj.type) result.type = schemaObj.type;
    if (schemaObj.required && Array.isArray(schemaObj.required) && schemaObj.required.length > 0) {
      result.required = schemaObj.required;
    }

    // Collapse deep nesting (>2 levels)
    if (depth >= 2) {
      return result.type ? { type: result.type } : { type: 'object' };
    }

    if (schemaObj.properties && typeof schemaObj.properties === 'object') {
      const props: Record<string, any> = {};
      for (const [propName, propDef] of Object.entries<any>(schemaObj.properties)) {
        if (typeof propDef === 'object') {
          props[propName] = this.simplifySchemaProperty(propDef, depth + 1);
        } else {
          props[propName] = propDef;
        }
      }
      result.properties = props;
    }

    if (schemaObj.items && typeof schemaObj.items === 'object') {
      result.items = this.simplifySchemaObject(schemaObj.items, depth + 1);
    }

    return result;
  }

  /**
   * Simplifies an individual property definition (removes descriptions, examples, defaults).
   */
  private simplifySchemaProperty(propDef: any, depth: number): any {
    const res: Record<string, any> = {};

    if (propDef.type) res.type = propDef.type;
    if (propDef.enum) res.enum = propDef.enum;

    if (propDef.type === 'object' && propDef.properties) {
      res.properties = this.simplifySchemaObject(propDef, depth).properties;
    }

    if (propDef.type === 'array' && propDef.items) {
      res.items = this.simplifySchemaObject(propDef.items, depth);
    }

    return Object.keys(res).length > 0 ? res : { type: propDef.type || 'string' };
  }
}
