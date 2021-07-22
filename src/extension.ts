import * as vscode from "vscode";
import axios from "axios";

const URL = "http://hipsum.co/api/";

interface HipsumParams {
  type: "hipster-centric" | "hipster-latin";
  paras?: number;
  sentences?: number;
  startWithLorem?: boolean;
}

function isStringArray(stuff: unknown): stuff is Array<string> {
  return (
    Array.isArray(stuff) &&
    stuff.every((paragraph) => typeof paragraph === "string")
  );
}

async function fetchData({
  type,
  paras,
  sentences,
  startWithLorem,
}: HipsumParams): Promise<Array<string>> {
  const data: unknown = await axios
    .get(URL, {
      params: {
        type,
        paras,
        sentences,
        "start-with-lorem": startWithLorem,
      },
    })
    .then((res) => res.data);

  if (!isStringArray(data)) {
    throw new Error("Invalid response");
  }

  return data;
}

async function getSentencesOrParagraphs(): Promise<
  "sentences" | "paragraphs" | undefined
> {
  const input = await vscode.window.showQuickPick<
    vscode.QuickPickItem & { id: "sentences" | "paragraphs" }
  >(
    [
      { id: "paragraphs", label: "Paragraphs" },
      { id: "sentences", label: "Sentences" },
    ],
    {
      title: "Do you want to insert a number of sentences or paragraphs?",
    }
  );

  return input?.id;
}

async function getNumber(
  sentencesOrParagraphs: "sentences" | "paragraphs"
): Promise<number | undefined> {
  const input = await vscode.window.showInputBox({
    title: `Enter number of ${sentencesOrParagraphs}`,
    value: "1",
    validateInput: (value) => {
      return isNaN(parseInt(value)) ? "Value must be an integer" : null;
    },
  });

  if (!input) {
    return;
  }

  return parseInt(input);
}

async function run(editor: vscode.TextEditor, edit: vscode.TextEditorEdit) {
  const sentencesOrParapgraphs = await getSentencesOrParagraphs();

  if (!sentencesOrParapgraphs) {
    return;
  }

  const number = await getNumber(sentencesOrParapgraphs);

  if (!number) {
    return;
  }

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Window,
      cancellable: false,
      title: "Fetching hipster ipsum...",
    },
    async (progress) => {
      progress.report({ increment: 0 });

      const data = await fetchData({
        type: "hipster-centric",
        [sentencesOrParapgraphs === "paragraphs" ? "paras" : "sentences"]:
          number,
      });

      progress.report({ increment: 100 });

      const processedString = data
        .join("\n\n") // Convert array of strings to string of double-newline separated paragraphs.
        .replace("  ", " "); // hipsum.co API separates sentences with two spaces for some reason.

      editor.edit((builder) => {
        builder.replace(editor.selection, processedString);
      });
    }
  );
}

export function activate(context: vscode.ExtensionContext) {
  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerTextEditorCommand(
    "hipsum-generator.generate",
    (editor, edit) => run(editor, edit)
  );

  context.subscriptions.push(disposable);
}

export function deactivate() {
  //
}
