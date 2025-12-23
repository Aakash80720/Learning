import { Annotation } from "@langchain/langgraph";
import { GEN_SYSTEM_PROMPT } from "./prompts.js";
import { RunnableConfig } from "@langchain/core/runnables";

export const configuration_schema = Annotation.Root({
    /**
     * The system prompt to be used by the agent.
     */
    system_prompt: Annotation<string>,
    /**
     * The name of the language model to be used by the agent.
     */
    model: Annotation<string>,
});

export function ensure_configuration(
    config: RunnableConfig,
): typeof configuration_schema.State {
    /**
     * Ensure the defaults are populated.
     */
    const configurable = config.configurable ?? {};
    return {
        system_prompt:
            configurable.system_prompt ?? GEN_SYSTEM_PROMPT,
        model: configurable.model ?? "gpt-4o",
    };
}