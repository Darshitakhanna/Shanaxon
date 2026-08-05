"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const fs_1 = require("fs");
const parser_1 = require("./parser");
const PYTHON_SAMPLE = `# Copyright (c) 2026 Project Dharohar-Context. All rights reserved.
# License: MIT

def add_numbers(a, b):
    """
    Adds two numbers and returns the result.
    """
    # Inline debug comment: calculate sum
    result = a + b
    return result

class Calculator:
    def __init__(self):
        # Initialize calc
        pass

    def multiply(self, x, y):
        """Multiplies x and y."""
        return x * y
`;
const GO_SAMPLE = `// Copyright (c) 2026 Project Dharohar-Context. All rights reserved.
// License: MIT

package main

import "fmt"

/**
 * Add function adds two integers.
 */
func Add(a int, b int) int {
	// Debug log
	fmt.Println("Adding numbers")
	return a + b
}

func main() {
	if true {
		fmt.Println("Main execution")
	}
}
`;
const RUST_SAMPLE = `// Copyright (c) 2026 Project Dharohar-Context. All rights reserved.
// License: MIT

/// Calculates the square of a number.
pub fn square(x: i32) -> i32 {
    // Square calculation
    x * x
}
`;
const JAVA_SAMPLE = `// Copyright (c) 2026 Project Dharohar-Context. All rights reserved.
// License: MIT

package com.example;

/**
 * Calculator class provides basic math operations.
 */
public class Calculator {
    private int value;

    /**
     * Constructs a new Calculator.
     */
    public Calculator() {
        this.value = 0;
    }

    /**
     * Adds two integers.
     */
    public int add(int a, int b) {
        // Debug comment: add numbers
        return a + b;
    }
}
`;
async function runTests() {
    console.log("=== Running Multi-Language & Smart Comment Verification ===");
    const pyFile = path.resolve(process.cwd(), 'src/core/verify_multilang_sample.py');
    const goFile = path.resolve(process.cwd(), 'src/core/verify_multilang_sample.go');
    const rsFile = path.resolve(process.cwd(), 'src/core/verify_multilang_sample.rs');
    const javaFile = path.resolve(process.cwd(), 'src/core/verify_multilang_sample.java');
    // Write temporary sample files
    await fs_1.promises.writeFile(pyFile, PYTHON_SAMPLE, 'utf-8');
    await fs_1.promises.writeFile(goFile, GO_SAMPLE, 'utf-8');
    await fs_1.promises.writeFile(rsFile, RUST_SAMPLE, 'utf-8');
    await fs_1.promises.writeFile(javaFile, JAVA_SAMPLE, 'utf-8');
    const engine = new parser_1.CodeCompressionEngine();
    await engine.init();
    try {
        // 1. Verify Python Compression & Docstring preservation
        console.log("\nTesting Python AST Optimization...");
        const pyAggressive = await engine.compress(PYTHON_SAMPLE, pyFile, 'aggressive');
        console.log("Python Aggressive Output:\n" + pyAggressive);
        console.log("-----------------------------------------");
        if (pyAggressive.includes("Copyright") || pyAggressive.includes("License: MIT")) {
            throw new Error("Python license header was not stripped!");
        }
        if (pyAggressive.includes("result = a + b")) {
            throw new Error("Python function body was not collapsed!");
        }
        if (pyAggressive.includes("Inline debug comment")) {
            throw new Error("Python inline comment was not stripped!");
        }
        if (!pyAggressive.includes('Adds two numbers and returns the result.')) {
            throw new Error("Python function docstring was lost!");
        }
        if (!pyAggressive.includes('Multiplies x and y.')) {
            throw new Error("Python class method docstring was lost!");
        }
        console.log("✓ Python AST optimization & docstring checks passed.");
        // 2. Verify Go Compression
        console.log("\nTesting Go AST Optimization...");
        const goAggressive = await engine.compress(GO_SAMPLE, goFile, 'aggressive');
        const goMedium = await engine.compress(GO_SAMPLE, goFile, 'medium');
        console.log("Go Aggressive Output:\n" + goAggressive);
        console.log("-----------------------------------------");
        if (goAggressive.includes("Copyright")) {
            throw new Error("Go license header was not stripped!");
        }
        if (goAggressive.includes("fmt.Println")) {
            throw new Error("Go function body was not collapsed!");
        }
        if (!goAggressive.includes("Add function adds two integers")) {
            throw new Error("Go function doc comment was lost!");
        }
        if (goMedium.includes("Debug log")) {
            // Inline comments should be stripped in medium tier
            throw new Error("Go inline comments inside functions were not stripped in medium tier!");
        }
        if (!goMedium.includes("fmt.Println(\"Main execution\")")) {
            // In medium tier, the if block collapses but the parent block is not collapsed
            if (goMedium.includes("if true { ... }")) {
                console.log("✓ Go medium tier control statement collapsing passed.");
            }
            else {
                throw new Error("Go medium tier control statement collapsed incorrectly!");
            }
        }
        console.log("✓ Go AST optimization & comments checks passed.");
        // 3. Verify Rust Compression
        console.log("\nTesting Rust AST Optimization...");
        const rsAggressive = await engine.compress(RUST_SAMPLE, rsFile, 'aggressive');
        console.log("Rust Aggressive Output:\n" + rsAggressive);
        console.log("-----------------------------------------");
        if (rsAggressive.includes("Copyright")) {
            throw new Error("Rust license header was not stripped!");
        }
        if (rsAggressive.includes("x * x")) {
            throw new Error("Rust function body was not collapsed!");
        }
        if (!rsAggressive.includes("Calculates the square of a number.")) {
            throw new Error("Rust triple-slash doc comment was lost!");
        }
        console.log("✓ Rust AST optimization checks passed.");
        // 4. Verify Java Compression
        console.log("\nTesting Java AST Optimization...");
        const javaAggressive = await engine.compress(JAVA_SAMPLE, javaFile, 'aggressive');
        console.log("Java Aggressive Output:\n" + javaAggressive);
        console.log("-----------------------------------------");
        if (javaAggressive.includes("Copyright") || javaAggressive.includes("License: MIT")) {
            throw new Error("Java license header was not stripped!");
        }
        if (javaAggressive.includes("this.value = 0") || javaAggressive.includes("return a + b")) {
            throw new Error("Java method or constructor body was not collapsed!");
        }
        if (javaAggressive.includes("Debug comment")) {
            throw new Error("Java inline comment was not stripped!");
        }
        if (!javaAggressive.includes("Calculator class provides basic math operations.") || !javaAggressive.includes("Adds two integers.")) {
            throw new Error("Java JSDoc comment was lost!");
        }
        console.log("✓ Java AST optimization checks passed.");
    }
    finally {
        // Cleanup temporary sample files
        await fs_1.promises.unlink(pyFile).catch(() => { });
        await fs_1.promises.unlink(goFile).catch(() => { });
        await fs_1.promises.unlink(rsFile).catch(() => { });
        await fs_1.promises.unlink(javaFile).catch(() => { });
    }
    console.log("\n=== All Multi-Language AST & Comment Tests Passed! ===");
}
runTests().catch((err) => {
    console.error("❌ Test Suite Failed:");
    console.error(err);
    process.exit(1);
});
