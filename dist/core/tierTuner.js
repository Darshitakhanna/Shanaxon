"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAutoTunedTier = getAutoTunedTier;
/**
 * Dynamically resolves file tier based on usage learning parameters:
 * - Frequently accessed files promote to normal.
 * - Stale files (untouched > 14 days) demote to aggressive.
 */
function getAutoTunedTier(filePath, tracker, defaultTier) {
    const usage = tracker.getUsage(filePath);
    if (!usage)
        return defaultTier;
    // Rule 1: Promote frequently accessed files
    if (usage.accessCount >= 5) {
        return 'normal';
    }
    // Rule 2: Demote cold/stale files (> 14 days ago)
    const lastAccess = new Date(usage.lastAccessed).getTime();
    const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    if (lastAccess < fourteenDaysAgo) {
        return 'aggressive';
    }
    return defaultTier;
}
