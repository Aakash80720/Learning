import { initChatModel } from "langchain/chat_models/universal";

export async function loadChatModel(
  fullySpecifiedName: string,
): Promise<ReturnType<typeof initChatModel>> {
  const index = fullySpecifiedName.indexOf("/");
  if (index === -1) {
    return await initChatModel(fullySpecifiedName);
  } else {
    const provider = fullySpecifiedName.slice(0, index);
    const model = fullySpecifiedName.slice(index + 1);
    return await initChatModel(model, { modelProvider: provider });
  }
}