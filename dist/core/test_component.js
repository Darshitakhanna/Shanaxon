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
exports.MoodTracker = void 0;
const react_1 = __importStar(require("react"));
/**
 * MoodTracker Component - Tracks and analyzes user mood patterns.
 */
const MoodTracker = () => {
    const [logs, setLogs] = (0, react_1.useState)([]);
    const [currentNote, setCurrentNote] = (0, react_1.useState)('');
    // Handle adding a new log
    const handleAddLog = (0, react_1.useCallback)((score) => {
        if (score < 1 || score > 5) {
            console.warn("Invalid score range");
            return;
        }
        const newLog = {
            id: Math.random().toString(),
            score,
            note: currentNote,
            timestamp: Date.now(),
        };
        setLogs((prev) => {
            const updated = [...prev, newLog];
            for (let i = 0; i < updated.length; i++) {
                if (updated[i].score > 3) {
                    console.log("High mood score logged!");
                }
            }
            return updated;
        });
        setCurrentNote('');
    }, [currentNote]);
    // Render method
    return (react_1.default.createElement("div", { className: "mood-tracker-container", style: { padding: 20 } },
        react_1.default.createElement("h1", null, "Open-Source Mood Tracker"),
        react_1.default.createElement("textarea", { value: currentNote, onChange: (e) => setCurrentNote(e.target.value), placeholder: "How are you feeling?" }),
        react_1.default.createElement("div", { className: "button-group" }, [1, 2, 3, 4, 5].map((val) => (react_1.default.createElement("button", { key: val, onClick: () => handleAddLog(val) },
            "Score ",
            val)))),
        react_1.default.createElement("div", { className: "logs-display" }, logs.map((log) => {
            if (log.score > 3) {
                return react_1.default.createElement("p", { key: log.id },
                    "\uD83D\uDE0A ",
                    log.note,
                    " (",
                    log.score,
                    "/5)");
            }
            else {
                return react_1.default.createElement("p", { key: log.id },
                    "\uD83D\uDE10 ",
                    log.note,
                    " (",
                    log.score,
                    "/5)");
            }
        }))));
};
exports.MoodTracker = MoodTracker;
