
/**
 * 
 * The functions in this module are the main entry points to the MathLive 
 * public API.
 * 
 * To invoke these functions, use the global MathLive object. For example:
 * ```javascript
 * const markup = MathLive.toMarkup('e^{i\\pi}+1=0');
 * ```
 * 
 * @module mathlive
 */

define([
    'mathlive/core/lexer', 
    'mathlive/core/mathAtom', 
    'mathlive/core/parser', 
    'mathlive/core/span', 
    'mathlive/core/definitions',
    'mathlive/editor/editor-mathfield',
    'mathlive/addons/auto-render',
    ], 
    function(Lexer, MathAtom, ParserModule, Span, Definitions, MathField, AutoRender) {

/**
 * Convert a LaTeX string to a string of HTML markup.
 * 
 * @param {string} text A string of valid LaTeX. It does not have to start 
 * with a mode token such as `$$` or `\(`.
 * 
 * @param {string} displayMode If `'displaystyle'` the "display" mode of TeX
 * is used to typeset the formula. Most appropriate for formulas that are 
 * displayed in a standalone block. If `'textstyle'` is used, the "text" mode
 * of TeX is used, which is most appropriate when displaying math "inline" 
 * with other text.
 * 
 * @param {string} [format='html'] For debugging purposes, this function 
 * can also return a text representation of internal data structures
 * used to construct the markup. Valid values include `'mathlist'` and `'span'`
 * 
 * @return {string}
 * @function module:mathlive#latexToMarkup
 */
function toMarkup(text, mathstyle, format, macros) {
    mathstyle = mathstyle || 'displaystyle';

    console.assert(/displaystyle|textstyle|scriptstyle|scriptscriptstyle/.test(mathstyle), 
        "Invalid style:", mathstyle);

    //
    // 1. Tokenize the text
    //
    const tokens = Lexer.tokenize(text);

    //
    // 2. Parse each token in the formula
    //    Turn the list of tokens in the formula into
    //    a tree of high-level MathAtom, e.g. 'genfrac'.
    //

    const mathlist = ParserModule.parseTokens(tokens, 'math', null, macros);

    if (format === 'mathlist') return mathlist;



    //
    // 3. Transform the math atoms into elementary spans
    //    for example from genfrac to vlist.
    //
    let spans = MathAtom.decompose({mathstyle: mathstyle}, mathlist);


    // 
    // 4. Simplify by coalescing adjacent nodes
    //    for example, from <span>1</span><span>2</span> 
    //    to <span>12</span>
    //
    spans = Span.coalesce(spans);

    if (format === 'span') return spans;

    //
    // 5. Wrap the expression with struts
    //
    const base = Span.makeSpan(spans, 'ML__base');

    const topStrut = Span.makeSpan('', 'ML__strut')
    topStrut.setStyle('height', base.height, 'em');
    const struts = [topStrut];
    if (base.depth !== 0) {
        const bottomStrut = Span.makeSpan('', 'ML__strut--bottom');
        bottomStrut.setStyle('height', base.height + base.depth, 'em');
        bottomStrut.setStyle('vertical-align', -base.depth, 'em');
        struts.push(bottomStrut);
    } 
    struts.push(base);
    const wrapper = Span.makeSpan(struts, 'ML__mathlive');


    // 
    // 6. Generate markup
    //

    return wrapper.toMarkup();
}

/**
 * @callback module:mathlive.mathfieldCallback
 * @param {Mathfield}
 *
 * @callback module:mathlive.mathfieldWithDirectionCallback
 * @param {Mathfield}
 * @param {number} direction
 * @return {boolean} False to suppress default behavior.
 */



/**
 * Convert a DOM element into an editable math field.
 * 
 * @param {HTMLElement|string} element An HTML DOM element, for example as obtained 
 * by `.getElementById()` or a string representing the ID of a DOM element.
 * 
 * @param {Object<string, *>} [config]
 * 
 * @param {string} [config.namespace=''] - Namespace that is added to `data-`
 * attributes to avoid collisions with other libraries. It is empty by default.
 * The namespace should be a string of lowercase letters.
 * 
 * @param {function} [config.substituteTextArea] - A function that returns a 
 * focusable element that can be used to capture text input. This can be
 * useful when a `<textarea>` element would be undesirable. Note that by default
 * on mobile devices the TextArea is automatically replaced with a `<span>` to
 * prevent the device virtual keyboard from being displayed.
 * 
 * @param {mathfieldCallback} [config.onFocus] - Invoked when the mathfield has 
 * gained focus
 * 
 * @param {mathfieldCallback} [config.onBlur] - Invoked when the mathfield has 
 * lost focus
 * 
 * @param {mathfieldCallback} [config.onKeystroke] - Invoked when a keystroke is
 * about to be processed. First argument is a string describing the keystroke,
 * the second is the keyboard event. Return false to stop handling of the event.
 * 
 * @param {boolean} [config.overrideDefaultInlineShortcuts=false] - If true 
 * the default inline shortcuts (e.g. 'p' + 'i' = 'π') are ignored.
 * 
 * @param {Object.<string, string>} [config.inlineShortcuts] - A map of shortcuts → replacement 
 * value. For example `{ 'pi': '\\pi'}`. If `overrideDefaultInlineShortcuts` is 
 * false, these shortcuts are applied after any default ones, and can therefore 
 * override them.
 * 
 * @param {boolean} [config.smartFence=true] - If true, when an open fence is
 * entered via `typedText()` it will generate a contextually appropriate markup,
 * for example using `\left...\right` if applicable. If false, the literal 
 * value of the character will be inserted instead.
 * 
 * @param {string} [config.virtualKeyboardToggleGlyph] - If specified, the markup 
 * to be used to display the virtual keyboard toggle glyph.
 * 
 * @param {string} [config.virtualKeyboardMode=''] - If `'manual'`, pressing the 
 * command bar toggle will display a virtual keyboard instead of the command bar.
 * If `'onfocus'`, the virtual keyboard will be displayed whenever the field is 
 * focused. In that case, the command bar toggle is not displayed. 
 * When this setting is not empty, `config.overrideDefaultCommands` and 
 * `config.commands` are ignored.
 * 
 * @param {string} [config.virtualKeyboards='all'] - A space separated list of
 * the keyboards that should be available. The keyboard `'all'` is synonym with:
 * 
 * * `'numeric'`, `'roman'`, `'greek'`, `'functions'` and `'command'`
 * 
 * The keyboards will be displayed in the order indicated.
 * 
 * @param {string} [config.virtualKeyboardRomanLayout='qwerty'] - The 
 * arrangement of the keys for the layers of the roman virtual keyboard.
 * One of `'qwerty'`, `'azerty'`, '`qwertz'`, '`dvorak`' or '`colemak`'.
 * 
 * @param {Object} [config.customVirtualKeyboardLayers] - Some additional
 * custom virtual keyboard layers. A keyboard is made up of one or more 
 * layers (think of the main layer and the shift layer on a hardware keyboard).
 * Each key in this object define a new keyboard layer (or replace an existing 
 * one). The value of the key should be some HTML markup.
 * 
 * @param {Object} [config.customVirtualKeyboards] - An object describing 
 * additional keyboards. Each key in the object is an ID for a separate keyboard.
 * The key should have a value made up of an object with the following keys:
 *    * tooltip: a string label describing the keyboard.
 *    * label: a string, displayed in the keyboard switcher to identify this 
 *           keyboard
 *    * layers: an array of strings, the ID of the layers used by this keyboard.
 *     These layers should be defined using `customVirtualKeyboardLayers`.
 *    * classes: a string, the classes to be added to the label for this keyboard
 * Possible values are 'tex' to use a TeX font to display the label.
 *    * layer: optional, the ID of the layer to switch to when the label of this
 * keyboard is clicked on in the keyboard switcher.
 *    * command: optional, a selector to perform when the label is clicked. 
 * Either the `command` or `layer` key must be present.
 * 
 * 
 * @param {boolean} [config.virtualKeyboardTheme=''] - The visual theme used
 * for the virtual keyboard. If empty, the theme will switch automatically
 * based on the device it's running on. The two supported themes are 
 * 'material' and 'apple' (the default).
 * 
 * @param {boolean} [config.keypressVibration='on'] When a key on the virtual 
 * keyboard is pressed, produce a short haptic feedback.
 * 
 * @param {boolean} [config.keypressSound=''] When a key on the virtual 
 * keyboard is pressed, produce a short audio feedback. The value should be 
 * either a URL to a sound file or an object with the following keys:
 *    * `delete` URL to a sound file played when the delete key is pressed
 *    * `return` ... when the return/tab key is pressed
 *    * `spacebar` ... when the spacebar is pressed
 *    * `default` ... when any other key is pressed. This key is required, the 
 * others are optional. If they are missing, this sound is played as well.
 * 
 * @param {mathfieldWithDirectionCallback} [config.onMoveOutOf] - A handler 
 * called when keyboard navigation would cause the insertion point to leave the
 * mathfield.
 * 
 * By default, the insertion point will wrap around.
 * 
 * @param {mathfieldWithDirectionCallback} [config.onTabOutOf] - A handler called when 
 * pressing tab (or shift-tab) would cause the insertion point to leave the mathfield.
 * 
 * By default, the insertion point jumps to the next point of interest.
 * 
 * @param {mathfieldWithDirectionCallback} [config.onDeleteOutOf] - A handler called when 
 * deleting an item would cause the insertion point to leave the mathfield.
 * 
 * By default, nothing happens. @todo Not implemented yet.
 * 
 * @param {mathfieldWithDirectionCallback} [config.onSelectOutOf] - A handler called when 
 * the selection is extended so that it would cause the insertion point to 
 * leave the mathfield.
 * 
 * By default, nothing happens. @todo Not implemented yet.
 * 
 * @param {mathfieldCallback} [config.onUpOutOf] - A handler called when 
 * the up arrow key is pressed with no element to navigate to.
 * 
 * By default, nothing happens. @todo Not implemented yet.
 * 
 * @param {mathfieldCallback} [config.onDownOutOf] - A handler called when 
 * the up down key is pressed with no element to navigate to.
 * 
 * By default, nothing happens. @todo Not implemented yet.
 * 
 * @param {mathfieldCallback} [config.onEnter] - A handler called when 
 * the enter/return key is pressed and it is not otherwise handled. @todo
 * 
 * @param {mathfieldCallback} [config.onContentWillChange] - A handler called 
 * just before the content is about to be changed.
 * 
 * @param {mathfieldCallback} [config.onContentDidChange] - A handler called 
 * just after the content has been changed.
 * 
 * @param {mathfieldCallback} [config.onSelectionWillChange] - A handler called 
 * just before the selection is about to be changed.
 * 
 * @param {mathfieldCallback} [config.onSelectionDidChange] - A handler called 
 * just after the selection has been changed.
 *  
 * @param {mathfieldCallback} [config.onVirtualKeyboardToggle] - A handler  
 * called after the virtual keyboard visibility has changed. The first argument
 * is true if the virtual keyboard is visible, the second argument is a DOM
 * element containing the virtual keyboard, which can be used to determine its
 * size (and therefore the portion of the screen it obscures) 
 *  
 * @return {MathField}
 * 
 * @function module:mathlive#makeMathField
 */
function makeMathField(element, config) {
    if (!MathField) {
        throw Error('The MathField module is not loaded.');
    }
    return new MathField.MathField(getElement(element), config)
}

/**
 * @return {string}
 * @function module:mathlive#latexToSpeakableText
 */
function toSpeakableText() {
    if (!MathAtom.toSpeakableText) {
        console.log('The SpokenText module is not loaded.');
        return;
    }
    MathAtom.toSpeakableText();
}

/**
 * Convert a LaTeX string to a string of MathML markup.
 * 
 * @param {string} latex A string of valid LaTeX. It does not have to start
 * with a mode token such as a `$$` or `\(`.
 * @return {string}
 * @function module:mathlive#latexToMathML
 */
function toMathML(latex, options) {
    if (!MathAtom.toMathML) {
        console.log('The MathML module is not loaded.');
        return '';
    }
    options = options || {macros:{}};
    Object.assign(options.macros, Definitions.MACROS);

    const mathlist = ParserModule.parseTokens(Lexer.tokenize(latex),
        'math', null, options.macros);

    return MathAtom.toMathML(mathlist, options);
}

/**
 * Convert a LaTeX string to an Abstract Syntax Tree
 * 
 * **See:** {@tutorial MASTON}
 * 
 * @param {string} latex A string of valid LaTeX. It does not have to start
 * with a mode token such as a `$$` or `\(`.
 * 
 * @return {Object} The Abstract Syntax Tree as a JavaScript object.
 * @function module:mathlive#latexToAST
 */
function latexToAST(latex, options) {
    if (!MathAtom.toAST) {
        console.log('The AST module is not loaded.');
        return {};
    }
    options = options || {macros:{}};
    Object.assign(options.macros, Definitions.MACROS);

    const mathlist = ParserModule.parseTokens(Lexer.tokenize(latex), 
        'math', null, options.macros);

    return MathAtom.toAST(mathlist, options);
}


/**
 * Transform all the elements in the document body that contain LaTeX code 
 * into typeset math.
 * 
 * **See:** {@tutorial USAGE_GUIDE}
 * 
 * @param {Object} [options] See [`renderMathInElement()`]{@link module:mathlive#renderMathInElement} 
 * for details
 * @function module:mathlive#renderMathInDocument
 */
function renderMathInDocument(options) {
    if (!AutoRender) {
        console.log('The AutoRender module is not loaded.');
        return;
    }

    AutoRender.renderMathInElement(document.body, options, toMarkup, toMathML);

    // Ask to be notified when fonts are loaded, and re-render.
    // There are rare cases where the layout needs to be recomputed after
    // fonts are loaded, e.g. the \compose command.
    if (document.fonts) {
        document.fonts.ready.then(() => renderMathInElement(document.body, options, toMarkup, toMathML));
    }
}

function getElement(element) {
    let result = element;
    if (typeof element === 'string') {
        result = document.getElementById(element);
        if (!result) {
            throw Error(`The element with ID "${element}" could not be found.`);
        }
    }
    return result;
}

/**
 * Transform all the children of `element`, recursively, that contain LaTeX code 
 * into typeset math.
 * 
 * **See:** {@tutorial USAGE_GUIDE}
 * 
 * @param {Element|string} element An HTML DOM element, or a string containing
 * the ID an element.
 * @param {Object} [options]
 * 
 * @param {string} [options.namespace=''] - Namespace that is added to `data-`
 * attributes to avoid collisions with other libraries. It is empty by default.
 * The namespace should be a string of lowercase letters.
 * @param {object[]} [options.macros={}] - Custom macros
 * @param {string[]} options.skipTags an array of tag names whose content will
 *  not be scanned for delimiters
 * @param {string} [options.ignoreClass='tex2jax_ignore'] a string used as a 
 * regular expression of class names of elements whose content will not be 
 * scanned for delimiters
 * @param {string} [options.processClass='tex2jax_process']   a string used as a
 * regular expression of class names of elements whose content **will** be 
 * scanned for delimiters,  even if their tag name or parent class name would 
 * have prevented them from doing so.
 * @param {boolean} [options.preserveOriginalContent=true] if true, store the 
 * original textual content of the element in a `data-original-content` 
 * attribute. This value can be accessed for example to restore the element to 
 * its original value:
 * ```javascript
 *      elem.innerHTML = elem.dataset.originalContent;
 * ```
 * @param {boolean} options.TeX.processEnvironments if false, math expression 
 * that start with `\begin{` will not automatically be rendered. (true by default)
 * @param {Array} options.TeX.delimiters.inline
 * @param {Array} options.TeX.delimiters.display `TeX.delimiters.display` arrays 
 * of delimiters that will trigger a render of the content in 'textstyle' or 
 * 'displaystyle', respectively.
 * @function module:mathlive#renderMathInElement
 */
function renderMathInElement(element, options) {
    if (!AutoRender) {
        console.log('The AutoRender module is not loaded.');
        return;
    }
    AutoRender.renderMathInElement(getElement(element), options, toMarkup, toMathML);
}

function validateNamespace(options) {
    if (options.namespace) {
        if (!/^[a-z]+[-]?$/.test(options.namespace)) {
            throw Error('options.namespace must be a string of lowercase characters only');
        }
        if (!/-$/.test(options.namespace)) {
           options.namespace += '-';
        }
    }
}

/**
 * 
 * @param {string|Element|MathField} element 
 * @param {Object} [options={}]
 * @param {string} options.namespace The namespace used for the `data-` 
 * attributes. If you used a namespace with `renderMathInElement`, you must
 * use the same namespace here.
 * @function module:mathlive#revertToOriginalContent
 */
function revertToOriginalContent(element, options) {
    element = getElement(element);
    
    // element is a pair: accessible span, math -- set it to the math part
    element = element.children[1];

    if (element instanceof MathField.MathField) {
        element.revertToOriginalContent();
    } else {
        options = options || {};
        validateNamespace(options); 
        element.innerHTML = element.getAttribute('data-' + 
            (options.namespace || '') + 'original-content');
    }
}



/**
 * 
 * @param {string|Element|MathField} element 
 * @param {Object} [options={}]
 * @param {string} options.namespace The namespace used for the `data-` 
 * attributes. If you used a namespace with `renderMathInElement`, you must
 * use the same namespace here.
 * @return {string} the original content of the element.
 * @function module:mathlive#revertToOriginalContent
 */
function getOriginalContent(element, options) {
    element = getElement(element);

    // element is a pair: accessible span, math -- set it to the math part
    element = element.children[1];

    if (element instanceof MathField.MathField) {
        return element.originalContent;
    }
    options = options || {};
    validateNamespace(options); 
    return element.getAttribute('data-' + 
        (options.namespace || '') + 'original-content');
}


return {
    latexToMarkup: toMarkup,
    latexToSpeakableText: toSpeakableText,
    latexToMathML: toMathML,
    latexToAST: latexToAST,
    makeMathField: makeMathField,
    renderMathInDocument: renderMathInDocument,
    renderMathInElement: renderMathInElement,
    revertToOriginalContent: revertToOriginalContent,
    getOriginalContent: getOriginalContent
}


})
