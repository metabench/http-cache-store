const jsgui = require('jsgui3-html');
const {controls, Control, mixins} = jsgui;
const {dragable, pressed_state} = mixins;


const {Text_Input, Button} = jsgui;

class URL_Bar extends jsgui.Control {


    // Should prob be the full bar, with bells and whistles. 

    constructor(spec) {
        super(spec);
        this.__type_name = 'url_bar';
        this.add_class('url-bar');
        //this.set('dom.attributes.class', 'url_bar');
        //this.set('dom.attributes.data-jsgui-type', 'url_bar');


        if (!spec.el) {
            this.compose_url_bar();
        }



    }

    compose_url_bar() {
        const {context} = this;
        

        const url_text_input = new Text_Input({
            context,
            //class: 'url-text-input'
        })
        url_text_input.add_class('url-text-input');
        const url_go_button = new Button({
            context,
            class: 'url-go-button',
            text: 'Go'
        });
        pressed_state(url_go_button);


        // Would be nice to have the pressed state functionality properly activate on the client side.

        this.add(url_text_input);
        this.add(url_go_button);

        this._ctrl_fields = this._ctrl_fields || {};
        this._ctrl_fields.url_text_input = url_text_input;
		this._ctrl_fields.url_go_button = url_go_button;
		
	}

    'activate'() {
		if (!this.__active) {
            super.activate();
            //pressed_state(this.url_go_button);

        }
    }
}

URL_Bar.css = `
    .url-bar {
        width: calc(100% - 10px);
        height: 32px;
        border: 1px solid #888;
        border-radius: 3px;
        padding: 2px;
        margin: 2px;
        display: flex;
    }

    .url-bar .url-text-input {
        width: calc(100% - 40px);
        height: 28px;
        border: none;
        border-radius: 3px;
        padding: 2px;
        margin: 2px;
        
    }

    .url-bar .url-go-button {
        width: 36px;
        height: 28px;
        border: none;
        border-radius: 3px;
        padding: 2px;
        margin: 2px;
        background-color: #CCCCCC;
        font-size: 18px;
        line-height: 26px;
    }

    .url-bar .url-go-button.pressed {
        
        background-color: #BBBBBB;
    }
`;

module.exports = URL_Bar;