const jsgui = require('jsgui3-client');
const {controls, Control, mixins} = jsgui;
const {dragable} = mixins;

//const 


const {Blank_HTML_Document} = jsgui;

const URL_Bar = require('./Controls/URL_Bar');

//jsgui.map_Controls['url_bar'] = URL_Bar;

controls.url_bar = URL_Bar;

// Want to make this as automatic and low-cost as possible to use.

// Also need to get the building of client code working properly.
//  When starting the server...?
//  Want really easy and simple top-level syntax.

// Maybe this should be in the 'client' part of the system...?
//   Due to ease of referencing it...?


// jsgui3-server-controls perhaps???

// jsgui3-client perhaps???

// May be worth doing more about 'server controls' or server-only functionality for the controls that will not get bundled / served
//   to the clients.

// jsgui3-html-server-control ???

// But basically want some server-side functionality, but it's still a control that gets rendered and sent to the client.
//   Could see about marking the server functions specifically.


// Moving this to jsgui3-html or jsgui3-client would make most sense.
//   jsgui3-client.
//     Could have an explanation as to why a Server_Control is in the 'client' module.








class Active_HTML_Document extends Blank_HTML_Document {



    constructor(spec = {}) {
        //console.log('Client_HTML_Document');
        super(spec);
        //spec.context.ctrl_document = this;
        this.active();
    }

    // Seems a bit like 'view features'.

    'include_js'(url) {
        /*
        Add it to the end of the body instead.
        */
        //var head = this.get('head');
        const body = this.get('body');
        var script = new jsgui.script({
            //<script type="text/JavaScript" src="abc.js"></script>
            'context': this.context
        });
        var dom = script.dom;
        var domAttributes = dom.attributes;
        domAttributes.type = 'text/javascript';
        domAttributes.src = url;
        body.add(script);
    }

    'include_css'(url) {
        var head = this.get('head');
        var link = new jsgui.link({
            //<script type="text/JavaScript" src="abc.js"></script>
            'context': this.context
        })
        // <script data-main="scripts/main" src="scripts/require.js"></script>
        var dom = link.dom;
        var domAttributes = dom.attributes;
        domAttributes['rel'] = 'stylesheet';
        domAttributes['type'] = 'text/css';
        //domAttributes.set('src', '/js/require.js');
        domAttributes['href'] = url;
        head.content.add(link);
    }

    'include_jsgui_client'(js_file_require_data_main) {
        js_file_require_data_main = js_file_require_data_main || '/js/web/jsgui-html-client';
        var head = this.head;
        var body = this.body;
        var script = new jsgui.script({
            //<script type="text/JavaScript" src="abc.js"></script>
            'context': this.context
        })
        var domAttributes = script.dom.attributes;
        domAttributes.set({
            'type': 'text/javascript',
            'src': '/js/web/require.js',
            'data-main': js_file_require_data_main
        });
        body.add(script);
    }
    'include_client_css'() {
        var head = this.get('head');
        var link = new jsgui.link({
            //<script type="text/JavaScript" src="abc.js"></script>
            'context': this.context
        });
        var domAttributes = link.dom.attributes;
        domAttributes.rel = 'stylesheet';
        domAttributes.type = 'text/css';
        domAttributes.href = '/css/basic.css';
        head.content.add(link);
        // <link rel="stylesheet" type="text/css" href="theme.css">
    }
    // also need to include jsgui client css
}

// Maybe better to include it within an Active_HTML_Document.

// Is currently a decent demo of a small active control running from the server, activated on the client.
//   This square box is really simple, and it demonstrates the principle of the code for the draggable square box not being all that complex
//   compared to a description of it.

// A container with reorderable internal draggable items could help.

// would be nice to be able to have all code in 1 file...???
//  Though the sever code should be separate.


// Relies on extracting CSS from JS files.
// Usage of windows should be very easy on this level.


class Demo_UI extends Active_HTML_Document {
    constructor(spec = {}) {
        spec.__type_name = spec.__type_name || 'demo_ui';
        super(spec);
        const {context} = this;

        // Make sure it requires the correct CSS.
        //  Though making that 'effortless' on the server may help more.


        // Maybe can't do this here???

        // Does not have .body (yet) on the client.
        //   simple way to get the client to attach the body of the Active_HTML_Document?
        //     maybe with jsgui-data-controls?
        //   Though automatically having the .body property available on the client without sending extra HTTP
        //     plumbing will help.

        // .body will not be available before activation.


        // .body should not be a normal function....?
        //   a getter function would be better.



        if (typeof this.body.add_class === 'function') {
            this.body.add_class('demo-ui');
        }

        //console.log('this.body', this.body);
        //console.log('this.body.add_class', this.body.add_class);


        const compose = () => {
            // put 20 of them in place.

            // Then how to arrange them...?

            const browser_window = new controls.Window({
                context: context,
                title: 'Web Cache',
                pos: [440, 10],
                size: [1024, 768],
            })
            this.body.add(browser_window);

            const url_bar = new URL_Bar({
                context
            });
            browser_window.inner.add(url_bar);

            // And add an address bar for the window.
            //   Maybe want a lower level URL / address bar control.

            const urls_window = new controls.Window({
                context: context,
                title: 'URLs',
                pos: [10, 10],
                size: [420, 840],
            })
            this.body.add(urls_window);

        }
        if (!spec.el) {
            compose();
        }
    }
    activate() {
        if (!this.__active) {
            super.activate();
            const {context} = this;

            //console.log('activate Demo_UI');
            // listen for the context events regarding frames, changes, resizing.

            context.on('window-resize', e_resize => {
                //console.log('window-resize', e_resize);

                // Make all internal controls go absolute in terms of position
                //   Remove them from their containers too?
                //   Ie their containing divs?

                // Would be nice to do this really simple with a fn call or very simple piece of code.
                // Like get absolute position, set position to be absolute, move to that position.
                // Maybe something within jsgui3-client helps with this, this is more about what needs to be done on the client.
                //   Though recognising perf implications, it's (more) OK to include client-side functionality in jsgui3-html.






            });

        }
    }
}

// Include this in bundling.
//  Want CSS bundling so that styles are read out from the JS document and compiled to a stylesheet.

//controls.Demo_UI = Demo_UI;

// A css file may be an easier way to get started...?
//  Want to support but not require css in js.

// But need to set up the serving of the CSS both on the server, and on the client.
//  Ofc setting it up on the server first is important - then can that stage set it up in the doc sent to the client?

// Including the CSS from the JS like before.
//  Needs to extract the CSS and serve it as a separate CSS file.
//  Should also have end-to-end regression tests so this does not break again in the future.
//   The code was kind of clunky and got refactored away.
//   

// Would need to parse the JS files to extract the CSS.
//  Maybe could do it an easier way??? Now that it's easy, want a faster way.


Demo_UI.css = `

* {
    margin: 0;
    padding: 0;
}

body {
    overflow-x: hidden;
    overflow-y: hidden;
    background-color: #E0E0E0;
}

.demo-ui {
    
    /* 

    display: flex;
    flex-wrap: wrap;
    
    flex-direction: column; 
    justify-content: center;
    align-items: center;
    text-align: center;
    min-height: 100vh;
    */
    
}
`;

// But may want to remove them from that flex upon picking up / dropping them.
//  Maybe best upon drop.

// Maybe want other examples that use absolute positioning to position the items at the start?
// 



//controls.Square_Box = Square_Box;
// could export jsgui with the updated controls....
//  so that they are in the correct Page Context.?


controls.Demo_UI = Demo_UI;

module.exports = jsgui;

/*
module.exports = {
    Square_Box: Square_Box,
    Demo_UI: Demo_UI
}
*/

// Then if window...?

// Need to add the Square_Box control to the context or original map of controls...

