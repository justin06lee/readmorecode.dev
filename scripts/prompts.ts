/** Re-export from lib so seed/repair/regenerate use the same prompts as the app. */
export {
  GENERATION_SYSTEM,
  buildGenerationUserPrompt,
  REPAIR_SYSTEM,
  buildRepairUserPrompt,
} from "../lib/prompts";
