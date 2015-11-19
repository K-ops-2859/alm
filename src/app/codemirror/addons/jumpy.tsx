import React = require("react");
import ReactDOM = require("react-dom");
import Radium = require('radium');
import csx = require('csx');
import * as utils from "../../../common/utils";
import * as styles from "../../styles/styles";
import * as state from "../../state/state";
import * as ui from "../../ui";
import * as uix from "../../uix";
import * as commands from "../../commands/commands";
import CodeMirror = require('codemirror');
import Modal = require('react-modal');

require('./jumpy.css');

let lowerCharacters = [];
for (let i = 'a'.charCodeAt(0); i < 'z'.charCodeAt(0); i++) {
    lowerCharacters.push(String.fromCharCode(i));
}
let keys: string[] = []
for (let c1 of lowerCharacters) {
    for (let c2 of lowerCharacters) {
        keys.push(c1 + c2);
    }
}

type Editor = CodeMirror.EditorFromTextArea;

interface JumpyWidget{
    node: HTMLDivElement;
    line: number;
    ch: number;
    key1: string;
    key2: string;
}

interface JumpyState {
    overlay?: HTMLDivElement;
    widgets?: JumpyWidget[];
}

function getState(cm:Editor): JumpyState{
    return (cm as any).state.jumpy || ((cm as any).state.jumpy = { widgets: [] });
}

function createOverlay(cm: Editor) {
    let doc = cm.getDoc();
    let {from,to} = cm.getViewport();
    let text = cm.getDoc().getRange({line:from,ch:0},{line:to,ch:0});
    let splitRegex = /^[A-Z]?[0-9a-z]+|^[\{\};]+/;

    let node = document.createElement('div');
    let scrollInfo = cm.getScrollInfo();
    let topLine = cm.coordsChar({top:scrollInfo.top,left: scrollInfo.left}, 'local').line;
    let bottomLine = cm.coordsChar({ top: scrollInfo.top + scrollInfo.clientHeight, left: scrollInfo.left }, 'local').line + 1;
    // console.log(scrollInfo,bottomLine-topLine);
    let lines = [];
    for (let i = 0; i < bottomLine - topLine; i++) {
        lines.push(i);
    }

    let keysIndex = 0;
    let charPxWidth = cm.defaultCharWidth();
    let charPxHeight = cm.defaultTextHeight() + 7;

    let overlayByLines = utils.selectMany(lines.map((x)=>{
        // Note `left` is coming out wrong after first line :-/
        // So we fudge it
        function getPxPos(line:number,ch:number){
            let pxPos = cm.charCoords(CodeMirror.Pos(line,ch),"local");
            return {top:pxPos.top - charPxHeight , left: charPxWidth * ch};
        }

        let trueLine = x + topLine;
        let string = doc.getLine(trueLine);

        let pos = 0;
        let lineOverlays = [];
        while (pos !== string.length) {
            var matches = /^[A-Z]?[0-9a-z]+|^[\{\};]+/.exec(string.substr(pos));
            if (matches && matches.length) {
                let matched = matches[0];
                let name = keys[keysIndex++];
                let pxPos = getPxPos(x,pos);
                // console.log('here', matched, pos,pxPos.left);
                let overlay = <div key={x+':'+pos} className="cm-jumpy" style={{top:`${pxPos.top}px`, left:`${pxPos.left}px`} as any}>{name}</div>;
                lineOverlays.push(overlay);
                pos += matched.length;
            } else {
                pos++;
            }
        }

        return lineOverlays;
    }));

    let overlay = ReactDOM.render(<div>
        {overlayByLines}
    </div>,node);

    return node;
}

function clearAnyOverlay(cm: Editor) {
    if (getState(cm).overlay) {
        getState(cm).overlay.parentElement.removeChild(getState(cm).overlay);
        getState(cm).overlay = null;
    }
}

function addOverlay(cm: Editor) {
    clearAnyOverlay(cm);
    let overlay = getState(cm).overlay = createOverlay(cm);

    let scrollInfo = cm.getScrollInfo();
    let pos = cm.coordsChar({top:scrollInfo.top,left: scrollInfo.left}, 'local');

    cm.addWidget(pos, overlay, false);
}

// Wire up the code mirror command to come here
CodeMirror.commands[commands.additionalEditorCommands.jumpy] = (editor: CodeMirror.EditorFromTextArea) => {
    let cursor = editor.getDoc().getCursor();
    let filePath = editor.filePath;
    let position = editor.getDoc().indexFromPos(cursor);

    // Subscribe to esc *once* to clear
    commands.esc.once(()=>{
        clearAnyOverlay(editor);
    });


    addOverlay(editor);
}
