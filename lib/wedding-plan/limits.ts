/**
 * Limits shared by the browser and the server. Kept in its own tiny module so
 * the onboarding UI can import them without bundling the AI prompt (which holds
 * real-wedding pricing data and belongs on the server only).
 */

/** Longest free-text note accepted from the couple in onboarding step 4. */
export const MAX_STORY_LENGTH = 500
