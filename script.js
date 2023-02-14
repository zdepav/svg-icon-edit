"use strict";
function store(key, value) {
    window.localStorage.setItem('60b894c5-svged-' + key, value);
}
function load(key, callback) {
    const val = window.localStorage.getItem('60b894c5-svged-' + key);
    if (val) {
        callback(val);
    }
}
class StringBuilder {
    constructor(startingValue) {
        this._arr = startingValue ? [startingValue] : [];
    }
    append(what) {
        if (typeof what === 'string') {
            this._arr.push(what);
        }
        else
            for (let item of what) {
                this._arr.push(item.toString());
            }
    }
    toString() {
        return this._arr.join('');
    }
}
const sizes = [16, 24, 32, 48, 64, 80, 96, 112, 128];
const baseSizes = [16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 104, 112, 120, 128];
$('#previews').append(sizes.map(() => {
    return $('<div>').addClass('preview').append($('<svg viewBox="0 0 16 16"><use href="#image"/></svg>'));
}));
function setViewBox(size) {
    $('#previews > .preview > svg').each(function () {
        this.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
    });
}
const viewBoxInput = $('#viewbox');
viewBoxInput.append(baseSizes.map(size => {
    return $('<option>').attr({ value: size }).text(size + 'pt');
})).on('change', () => {
    const val = viewBoxInput.val();
    setViewBox(val);
    store('size', val);
});
load('size', value => { viewBoxInput.val(value); });
setViewBox(viewBoxInput.val());
const fillRuleInput = $('#fillrule');
fillRuleInput.append($('<option>').attr({ value: 'evenodd' }).text('Even / Odd')).append($('<option>').attr({ value: 'nonzero' }).text('Non-Zero')).on('change', () => {
    const val = fillRuleInput.val();
    $('#image').attr({ 'fill-rule': val });
    store('fill-rule', val);
});
load('fill-rule', value => { fillRuleInput.val(value); });
$('#image').attr({ 'fill-rule': fillRuleInput.val() });
const colorInputStyle = $('<style>').appendTo($('head'));
function setColorInputPreview(color) {
    colorInputStyle.text('#fillcolor-container::after{background-color:' + color + ' !important;}');
}
const fillColorInput = $('#fillcolor');
fillColorInput.on('input', () => {
    if (fillColorInput[0].checkValidity()) {
        const val = fillColorInput.val();
        $('#image').attr({ fill: val });
        store('fill-color', val);
        setColorInputPreview(val);
    }
});
load('fill-color', value => {
    fillColorInput.val(value);
    $('#image').attr({ fill: value });
    setColorInputPreview(value);
});
class FullParserState {
    constructor() {
        this.start = { x: 0, y: 0 };
        this.pos = { x: 0, y: 0 };
        this.instruction = null;
        this.relative = false;
        this.args = [];
        this.errors = [];
    }
    absX2rel(x) { return x - this.pos.x; }
    absY2rel(y) { return y - this.pos.y; }
    relX2abs(x) { return this.pos.x + x; }
    relY2abs(y) { return this.pos.y + y; }
    fixRelAbsX(args, i) {
        if (this.relative) {
            args.a[i] = this.relX2abs(args.a[i]);
        }
        else {
            args.r[i] = this.absX2rel(args.r[i]);
        }
    }
    fixRelAbsY(args, i) {
        if (this.relative) {
            args.a[i] = this.relY2abs(args.a[i]);
        }
        else {
            args.r[i] = this.absY2rel(args.r[i]);
        }
    }
    fixRelAbsXY(args, i) {
        this.fixRelAbsX(args, i);
        this.fixRelAbsY(args, i + 1);
    }
}
class Token {
    constructor(num, val, line, col) {
        this.num = num;
        this.val = val;
        this.line = line;
        this.col = col;
    }
}
function prettyPrintNumber(n) {
    if (Math.abs(n) < 0.001) {
        return '0';
    }
    const num = (n + Number.EPSILON).toFixed(3).replace(/\.?0+$/, '');
    return num.length > 0 && num !== '-' ? num : '0';
}
class Instruction {
    constructor(letters, argCount, parse, prettyPrint) {
        this.letters = letters;
        this.argCount = argCount;
        this._parse = parse;
        this._prettyPrint = prettyPrint;
    }
    parse(state) {
        const args = { i: this, r: state.args, a: state.args.slice() };
        if (this.argCount > 0) {
            for (let i = 0; i + this.argCount - 1 < state.args.length; i += this.argCount) {
                this._parse(state, args, i);
            }
        }
        else {
            this._parse(state, args, 0);
        }
        return args;
    }
    prettyPrint(args, output) {
        if (this.argCount === 0) {
            output.append(this.letters[1]);
            return;
        }
        for (let j = 0; j < args.a.length; j += this.argCount) {
            if (j > 0) {
                output.append(' ');
            }
            let argv;
            if (this.letters == 'Mm') {
                output.append(j > 0 ? 'l' : 'M');
                argv = j == 0 ? args.a : args.r;
            }
            else {
                output.append(this.letters[1]);
                argv = args.r;
            }
            output.append(' ');
            if (args.a.length - j < this.argCount) {
                for (let i = j; i < args.a.length; ++i) {
                    if (i > j) {
                        output.append(',');
                    }
                    output.append(prettyPrintNumber(argv[i]));
                }
            }
            else if (this._prettyPrint) {
                this._prettyPrint(argv, j, output);
            }
            else {
                for (let i = 0; i < this.argCount; i += 2) {
                    if (i > 0) {
                        output.append(' ');
                    }
                    output.append(prettyPrintNumber(argv[j + i]));
                    if (i + 1 < this.argCount) {
                        output.append(',');
                        output.append(prettyPrintNumber(argv[j + i + 1]));
                    }
                }
            }
        }
    }
    _minifyNumber(n, output) {
        output.append(prettyPrintNumber(n).replace(/^(-)?0\./, '$1.'));
    }
    _minifyArgs(args, output) {
        for (let i = 0; i < args.length; ++i) {
            if (i > 0 && args[i] >= -0.001) {
                output.append(',');
            }
            this._minifyNumber(args[i], output);
        }
    }
    minify(args, output) {
        if (this.argCount === 0) {
            output.append(this.letters[1]);
            return;
        }
        const outR = new StringBuilder(), outA = new StringBuilder();
        this._minifyArgs(args.r, outR);
        this._minifyArgs(args.a, outA);
        const strR = outR.toString(), strA = outA.toString();
        if (strR.length < strA.length) {
            output.append(this.letters[1]);
            output.append(strR);
        }
        else {
            output.append(this.letters[0]);
            output.append(strA);
        }
    }
}
const instructions = {
    M: new Instruction('Mm', 2, (state, args, i) => {
        state.fixRelAbsXY(args, i);
        state.pos = { x: args.a[i], y: args.a[i + 1] };
        if (i === 0) {
            state.start = state.pos;
        }
    }),
    L: new Instruction('Ll', 2, (state, args, i) => {
        state.fixRelAbsXY(args, i);
        state.pos = { x: args.a[i], y: args.a[i + 1] };
    }),
    H: new Instruction('Hh', 1, (state, args, i) => {
        state.fixRelAbsX(args, i);
        state.pos = { x: args.a[i], y: state.pos.y };
    }),
    V: new Instruction('Vv', 1, (state, args, i) => {
        state.fixRelAbsY(args, i);
        state.pos = { x: state.pos.x, y: args.a[i] };
    }),
    C: new Instruction('Cc', 6, (state, args, i) => {
        state.fixRelAbsXY(args, i);
        state.fixRelAbsXY(args, i + 2);
        state.fixRelAbsXY(args, i + 4);
        state.pos = { x: args.a[i + 4], y: args.a[i + 5] };
    }),
    S: new Instruction('Ss', 4, (state, args, i) => {
        state.fixRelAbsXY(args, i);
        state.fixRelAbsXY(args, i + 2);
        state.pos = { x: args.a[i + 2], y: args.a[i + 3] };
    }),
    Q: new Instruction('Qq', 4, (state, args, i) => {
        state.fixRelAbsXY(args, i);
        state.fixRelAbsXY(args, i + 2);
        state.pos = { x: args.a[i + 2], y: args.a[i + 3] };
    }),
    T: new Instruction('Tt', 2, (state, args, i) => {
        state.fixRelAbsXY(args, i);
        state.pos = { x: args.a[i], y: args.a[i + 1] };
    }),
    A: new Instruction('Aa', 7, (state, args, i) => {
        state.fixRelAbsXY(args, i + 5);
        state.pos = { x: args.a[i + 5], y: args.a[i + 6] };
    }, (args, i, output) => {
        output.append([
            prettyPrintNumber(args[i]), ',',
            prettyPrintNumber(args[i + 1]), ' ',
            prettyPrintNumber(args[i + 2]), ' ',
            (args[i + 3] === 0 ? '0' : '1'), ' ',
            (args[i + 4] === 0 ? '0' : '1'), ' ',
            prettyPrintNumber(args[i + 5]), ',',
            prettyPrintNumber(args[i + 6])
        ]);
    }),
    Z: new Instruction('Zz', 0, (state, args, i) => {
        state.pos = state.start;
    }),
};
const numberRegex = /-?(?:[0-9]*\.)?[0-9]+(?:[eE][-+]?[0-9]+)?/y;
function tokenize(data, errors) {
    const tokens = [];
    let line = 1, col = 1;
    let prevWasComma = false;
    let inComment = false;
    for (let i = 0; i < data.length; ++i, ++col) {
        const c = data[i];
        if (c == '\n') {
            ++line;
            col = 0;
            prevWasComma = false;
            inComment = false;
            continue;
        }
        else if (c == '\r') {
            if (i + 1 < data.length && data[i + 1] == '\n') {
                ++i;
            }
            ++line;
            col = 0;
            prevWasComma = false;
            inComment = false;
            continue;
        }
        else if (inComment) {
            continue;
        }
        else if (c == '#') {
            inComment = true;
            continue;
        }
        else if (/^[a-z]$/i.test(c)) {
            const C = c.toUpperCase();
            if (C in instructions) {
                tokens.push(new Token(false, { instruction: instructions[C], relative: c !== C }, line, col));
            }
            else {
                errors.push('Invalid command "' + c + '" at line ' + line + ', column ' + col);
            }
            prevWasComma = false;
            continue;
        }
        else if (c == ',') {
            if (prevWasComma) {
                errors.push('Unexpected character "," at line ' + line + ', column ' + col);
            }
            prevWasComma = true;
            continue;
        }
        else if (/\s/.test(c)) {
            prevWasComma = false;
            continue;
        }
        prevWasComma = false;
        numberRegex.lastIndex = i;
        const m = data.match(numberRegex);
        if (m) {
            let val = 0;
            try {
                val = parseFloat(m[0]);
            }
            catch (ex) {
                errors.push('Invalid number ' + m[0] + ' at line ' + line + ', column ' + col);
            }
            tokens.push(new Token(true, val, line, col));
            i += m[0].length - 1;
            col += m[0].length - 1;
            continue;
        }
        errors.push('Invalid character ' + (c == '"' ? "'\"'" : '"' + c + '"') +
            ' at line ' + line + ', column ' + col);
    }
    return tokens;
}
function parse(data) {
    const state = new FullParserState();
    const tokens = tokenize(data, state.errors);
    const ret = [];
    let token;
    function processArgs() {
        if (state.instruction) {
            ret.push(state.instruction.parse(state));
            if (state.instruction.argCount > 0 && (state.args.length < state.instruction.argCount ||
                state.args.length % state.instruction.argCount > 0)) {
                state.errors.push('Wrong number of arguments to "' + token.val.instruction.letters[token.val.relative ? 1 : 0] +
                    '" at line ' + token.line + ', column ' + token.col);
            }
        }
    }
    for (token of tokens) {
        if (token.num) {
            if (state.instruction && state.instruction.argCount == 0) {
                state.errors.push('Unexpected number at line ' + token.line + ', column ' + token.col);
            }
            else {
                state.args.push(token.val);
            }
        }
        else {
            processArgs();
            if ((!state.instruction || state.instruction == instructions.Z) &&
                token.val.instruction != instructions.M) {
                state.errors.push('Expected MoveTo, found "' + token.val.instruction.letters[token.val.relative ? 1 : 0] +
                    '" at line ' + token.line + ', column ' + token.col);
            }
            state.instruction = token.val.instruction;
            state.relative = token.val.relative;
            state.args = [];
        }
    }
    processArgs();
    return { data: ret, errors: state.errors };
}
function prettyPrint(data) {
    const out = new StringBuilder();
    for (let i = 0; i < data.length; ++i) {
        if (i > 0) {
            out.append(data[i - 1].i == instructions.Z ? '\n' : ' ');
        }
        data[i].i.prettyPrint(data[i], out);
    }
    return out.toString();
}
function minify(data) {
    const out = new StringBuilder();
    for (let i = 0; i < data.length; ++i) {
        data[i].i.minify(data[i], out);
    }
    return out.toString();
}
function validatePathData(data) {
    const parsed = parse(data);
    if (parsed.errors.length > 0) {
        $('#errors').text(parsed.errors.join('\n'));
        return false;
    }
    else {
        $('#errors').empty();
        return true;
    }
}
const pathDataInput = $('#pathdata');
load('path-data', value => {
    pathDataInput.val(value);
    $('#image').attr({ d: value });
});
CodeMirror.defineMode('svg_path_data', function (config, parserConfig) {
    const indentUnit = config.indentUnit;
    return {
        startState: function () {
            return { indent: 0, expectedArgCount: 0, argCount: 0, prevWasComma: false };
        },
        token: function (stream, state) {
            let style = 'error', c;
            if (stream.eatSpace()) {
                style = null;
                state.prevWasComma = false;
            }
            else if (stream.eat('#')) {
                style = 'comment';
                stream.skipToEnd();
            }
            else if (stream.eat(',')) {
                style = state.prevWasComma ? 'error' : null;
                state.prevWasComma = true;
            }
            else if (c = stream.eat(/[MLHVCSQTAZ]/i)) {
                state.prevWasComma = false;
                c = c.toUpperCase();
                if (c == 'Z') {
                    state.indent = 0;
                }
                else if (c == 'M') {
                    state.indent = indentUnit;
                }
                style = (state.expectedArgCount > 0
                    ? (state.argCount < state.expectedArgCount || state.argCount % state.expectedArgCount != 0)
                    : c != 'M') ? 'keyword error' : 'keyword';
                state.argCount = 0;
                state.expectedArgCount = instructions[c].argCount;
            }
            else if (stream.match(/^-?(?:[0-9]*\.)?[0-9]+(?:[eE][-+]?[0-9]+)?/)) {
                state.prevWasComma = false;
                if (state.expectedArgCount == 0) {
                    style = 'error';
                }
                else {
                    ++state.argCount;
                    style = 'number';
                }
            }
            else if (!stream.eatWhile(/[BDEFGIJKNOPRUWXY]/i)) {
                state.prevWasComma = false;
                stream.next();
            }
            return style;
        },
        indent(state, textAfter) {
            return state.indent;
        }
    };
});
var editor = CodeMirror.fromTextArea(document.getElementById('pathdata'), {
    lineNumbers: true,
    lineWrapping: true,
    mode: 'svg_path_data',
    theme: 'svg-path-data'
});
editor.on('change', () => {
    const val = editor.getValue();
    if (validatePathData(val)) {
        $('#image').attr({ d: val });
        store('path-data', val);
    }
});
const nameInput = $('#name'), idOutput = $('#id');
function setId(name) {
    idOutput.text(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
}
nameInput.on('input', () => {
    const val = nameInput.val();
    setId(val);
    store('name', val);
});
load('name', value => {
    nameInput.val(value);
    setId(value);
});
function buildOutput(svgFormat) {
    const code = editor.getValue();
    const parsed = parse(code);
    const metadata = {
        format: 'SVG-EDit-v1.0',
        createdIn: 'https://jsfiddle.net/zdepav/ymqhzepL',
        name: nameInput.val(),
        id: idOutput.text(),
        color: fillColorInput.val(),
        fillRule: fillRuleInput.val(),
        baseSize: viewBoxInput.val(),
        source: code.split(/\n|\r\n?/g),
        errors: parsed.errors
    };
    return svgFormat ? ('<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
        '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' +
        '<svg viewBox="0 0 ' + metadata.baseSize + ' ' + metadata.baseSize + '">\n' +
        '  <path fill="' + (metadata.color == 'currentColor' ? '#000000' : metadata.color) + '"' +
        ' fill-rule="' + metadata.fillRule + '"' +
        ' d="' + minify(parsed.data) + '"/>\n' +
        '</svg>\n' +
        '<!-- Metadata ' + JSON.stringify(metadata, null, 2) + ' -->\n') : ('<!-- Definition -->\n' +
        '\n' +
        '<svg style="display:none">\n' +
        '  <path id="' + metadata.id + '"' +
        ' fill="' + metadata.color + '"' +
        ' fill-rule="' + metadata.fillRule + '"' +
        ' d="' + minify(parsed.data) + '"/>\n' +
        '</svg>\n' +
        '\n' +
        '<!-- Usage -->\n' +
        '\n' +
        '<svg viewBox="0 0 ' + metadata.baseSize + ' ' + metadata.baseSize +
        '"><use href="#' + metadata.id + '"/></svg>\n' +
        '\n' +
        '<!-- Metadata ' + JSON.stringify(metadata, null, 2) + ' -->\n');
}
$('#export').on('click', () => {
    hljs.highlightElement($('#output').text(buildOutput(false)).attr({
        'data-file': idOutput.text() + '.svged.html',
    })[0]);
});
$('#download-svg, #download').on('click', (e) => {
    const out = $('#output');
    const svgFormat = e.target.id == 'download-svg';
    const a = $('<a>').attr({
        href: 'data:text/plain;charset=utf-8,' + encodeURIComponent(buildOutput(svgFormat)),
        download: idOutput.text() + (svgFormat ? '.svged.svg' : '.svged.html')
    }).css({
        display: 'none'
    }).appendTo($('body'));
    a[0].click();
    a.remove();
});
$('#reformat').on('click', () => {
    const parsed = parse(editor.getValue());
    if (parsed.errors.length > 0) {
        alert('Reformat failed');
    }
    else {
        editor.setValue(prettyPrint(parsed.data));
    }
});
function processFile(content) {
    const match = content.match(/<!--\s*Metadata\s*(\{.+\})\s*-->/is);
    if (!match) {
        alert('Invalid file');
        return;
    }
    try {
        const data = JSON.parse(match[1]);
        nameInput.val(data.name);
        setId(data.name);
        const src = data.source.join('\n');
        editor.setValue(src);
        fillColorInput.val(data.color);
        setColorInputPreview(data.color);
        fillRuleInput.val(data.fillRule);
        viewBoxInput.val(data.baseSize);
        setViewBox(data.baseSize);
        $('#image').attr({
            d: src,
            fill: data.color,
            'fill-rule': data.fillRule
        });
        store('name', data.name);
        store('path-data', src);
        store('fill-color', data.color);
        store('fill-rule', data.fillRule);
        store('size', data.baseSize);
    }
    catch (ex) {
        alert('Invalid file');
    }
}
$('#file-upload').on('change', () => {
    var file = $('#file-upload').prop('files')[0];
    if (file) {
        var reader = new FileReader();
        reader.onload = e => {
            processFile(e.target.result);
        };
        reader.readAsText(file);
    }
});
const reference = $('#reference');
reference.children('caption').on('click', () => {
    reference.toggleClass('closed');
});
const uiZoom = $('#ui-zoom');
let zoom = 10;
function setZoom(newZoom) {
    if (newZoom < 5 || newZoom > 30) {
        return;
    }
    zoom = newZoom;
    const zoomStr = zoom + '0%';
    $('html').css({ zoom: zoomStr });
    uiZoom.children('div:nth-child(2)').text(zoomStr);
    store('zoom', zoom.toString());
}
uiZoom.children('div:first-child').on('click', () => { setZoom(zoom - 1); });
uiZoom.children('div:last-child').on('click', () => { setZoom(zoom + 1); });
load('zoom', z => { setZoom(parseInt(z)); });
