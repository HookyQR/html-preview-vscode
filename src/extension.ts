"use strict";
import {
    window, ExtensionContext, commands, Uri,
    ViewColumn, TextDocument, TextEditor, workspace
} from "vscode";
import * as uuid from "node-uuid";
import { HtmlDocumentView } from "./document";

export enum SourceType {
    SCRIPT,
    STYLE
}
let viewManager: ViewManager;
export function activate(context: ExtensionContext) {
    viewManager = new ViewManager();

    context.subscriptions.push(
        commands.registerCommand("html.previewToSide", uri => viewManager.preview(uri, true)),
        commands.registerCommand("html.preview", () => viewManager.preview()),
        commands.registerCommand("html.source", () => viewManager.source())
    );
}

export function deactivate() {
    viewManager.dispose();
}

class ViewManager {
    private idMap: IDMap = new IDMap();
    private fileMap: Map<string, HtmlDocumentView> = new Map<string, HtmlDocumentView>();

    private sendHTMLCommand(displayColumn: ViewColumn, doc: TextDocument, toggle: boolean = false) {
        let id: string;
        let htmlDoc: HtmlDocumentView;
        if (!this.idMap.hasUri(doc.uri)) {
            htmlDoc = new HtmlDocumentView(doc);
            id = this.idMap.add(doc.uri, htmlDoc.uri);
            this.fileMap.set(id, htmlDoc);
        } else {
            id = this.idMap.getByUri(doc.uri);
            htmlDoc = this.fileMap.get(id);
        }
        htmlDoc.execute(displayColumn);
    }

    private getViewColumn(sideBySide: boolean): ViewColumn {
        const active = window.activeTextEditor;
        if (!active) {
            return ViewColumn.One;
        }

        if (!sideBySide) {
            return active.viewColumn;
        }

        switch (active.viewColumn) {
            case ViewColumn.One:
                return ViewColumn.Two;
            case ViewColumn.Two:
                return ViewColumn.Three;
        }

        return active.viewColumn;
    }

    public source(mdUri?: Uri) {
        if (!mdUri) {
            return commands.executeCommand('workbench.action.navigateBack');
        }

        const docUri = Uri.parse(mdUri.query);

        for (let editor of window.visibleTextEditors) {
            if (editor.document.uri.toString() === docUri.toString()) {
                return window.showTextDocument(editor.document, editor.viewColumn);
            }
        }

        return workspace.openTextDocument(docUri).then(doc => {
            return window.showTextDocument(doc);
        });
    }

    public preview(uri?: Uri, sideBySide: boolean = false) {

        let resource = uri;
        if (!(resource instanceof Uri)) {
            if (window.activeTextEditor) {
                // we are relaxed and don't check for markdown files
                resource = window.activeTextEditor.document.uri;
            }
        }

        if (!(resource instanceof Uri)) {
            if (!window.activeTextEditor) {
                // this is most likely toggling the preview
                return commands.executeCommand('html.source');
            }
            // nothing found that could be shown or toggled
            return;
        }
        // activeTextEditor does not exist when triggering on a html preview
        this.sendHTMLCommand(this.getViewColumn(sideBySide),
            window.activeTextEditor.document);
    }

    public dispose() {
        let values = this.fileMap.values()
        let value: IteratorResult<HtmlDocumentView> = values.next();
        while (!value.done) {
            value.value.dispose();
            value = values.next();
        }
    }
}

class IDMap {
    private map: Map<[Uri, Uri], string> = new Map<[Uri, Uri], string>();

    public getByUri(uri: Uri) {
        let keys = this.map.keys()
        let key: IteratorResult<[Uri, Uri]> = keys.next();
        while (!key.done) {
            if (key.value.indexOf(uri) > -1) {
                return this.map.get(key.value);
            }
            key = keys.next();
        }
        return null;
    }

    public hasUri(uri: Uri) {
        return this.getByUri(uri) !== null;
    }

    public add(uri1: Uri, uri2: Uri) {
        let id = uuid.v4();
        this.map.set([uri1, uri2], id);
        return id;
    }
}
