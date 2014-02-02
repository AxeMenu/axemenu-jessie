const ShellVersion = imports.misc.config.PACKAGE_VERSION.split(".");
const Version = '0.8.4';
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const ModalDialog = imports.ui.modalDialog;
const AppFavorites = imports.ui.appFavorites;
const Gio = imports.gi.Gio;
const Signals = imports.signals;

const cleanActor = (ShellVersion[1] < 4) ? function (o) {
    return o.destroy_children();
} : function (o) {
    return o.destroy_all_children();
};


const insert_actor_to_box = (ShellVersion[1] < 4) ? function (box, actor, position) {
    return box.insert_actor(actor, position);
} : function (box, actor, position) {
    return box.insert_child_at_index(actor, position);
};


/**
 * @brief describes the button of the system app
 * @param app
 * @param iconsize
 * @param {ApplicationsButton} parent - main menu button
 * @constructor
 */
function ApplicationButton(app, iconsize, parent) {
    this._init(app, iconsize, parent);
}
ApplicationButton.prototype = {
    _init: function (app, iconsize, parent) {
        this.app = app;
        this.parent = parent;
        this.actor = new St.Button({ reactive: true, label: this.app.get_name(), style_class: 'application-button', x_align: St.Align.START });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        let labelclass = AppFavorites.getAppFavorites().isFavorite(app.get_id()) ? 'application-button-label-favorites' : 'application-button-label';
        this.label = new St.Label({ text: this.app.get_name(), style_class: labelclass });
        this.icon = this.app.create_icon_texture(iconsize);
        //this.icon = new St.Icon({icon_size: size, gicon: new Gio.ThemedIcon({name: app.get_name()})});
        this.buttonbox.add_actor(this.icon);
        this.buttonbox.add(this.label, { y_align: St.Align.MIDDLE, y_fill: false });
        this.actor.set_child(this.buttonbox);
        this._releaseEventId = this.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));
        this._clickEventId = this.actor.connect('clicked', Lang.bind(this, function () {
            this.app.open_new_window(-1);
            parent.menu.close();
        }));
        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
    },
    _onButtonRelease: function (actor, event) {
        let button = event.get_button();
        if (button == 3) {
            if (this._confirmDialog == null) {
                this._confirmDialog = new ConfirmDialog(this.app);
            }
            this._confirmDialog.open();
        }
    },
    _onDestroy: function () {
        if (this._clickEventId) this.actor.disconnect(this._clickEventId);
        if (this._releaseEventId) this.actor.disconnect(this._releaseEventId);
    }
};
Signals.addSignalMethods(ApplicationButton.prototype);

/**
 *
 * @param app {ApplicationsButton}
 * @constructor
 */
function ConfirmDialog(app) {
    this._init(app);
}
ConfirmDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,
    _init: function (app) {
        ModalDialog.ModalDialog.prototype._init.call(this, { styleClass: 'confirm-dialog' });
        this._app = app;
        this.apFav = AppFavorites.getAppFavorites();
        this.is_fav = this.apFav.isFavorite(app.get_id());
        let headLabel = this.is_fav ? _("Remove \"%s\" from favorites?") : _("Add \"%s\" to favorites?");
        let header = new St.Label({ style_class: 'config-dialog-header', text: headLabel.format(this._app.get_name()) });
        this.contentLayout.add(header, { expand: true, x_fill: false, y_fill: false, x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
        let buttons = [
            { action: Lang.bind(this, this._processApp), label: _("Yes") },
            { action: Lang.bind(this, this._closeModal), label: _("No") }
        ];
        this.setButtons(buttons);
        this.buttonLayout.style = ("padding-top: 50px;");
        this._buttonKeys[Clutter.KEY_Escape] = Lang.bind(this, this._closeModal);
    },
    _processApp: function () {
        if (this.is_fav)
            this.apFav.removeFavorite(this._app.get_id());
        else
            this.apFav.addFavorite(this._app.get_id());
        this.close();
    },
    _closeModal: function () {
        this.close();
    }
};

function BaseButton(label, icon, iconsize, icontype, onclick) {
    this._init(label, icon, iconsize, icontype, onclick);
}
BaseButton.prototype = {
    _init: function (label, icon, iconsize, icontype, onclick) {
        this.actor = new St.Button({ reactive: true, label: label, style_class: 'application-button am-' + icon + '-button', x_align: St.Align.START });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        //icontype = (icontype) ? icontype : St.IconType.SYMBOLIC;
        if (icon) {
            //this.icon = new St.Icon({icon_name: icon, icon_size: iconsize});
            this.icon = new St.Icon({gicon: new Gio.ThemedIcon({name:icon}), icon_size:iconsize});
            this.buttonbox.add_actor(this.icon);
        }
        if (label) {
            this.label = new St.Label({ text: label, style_class: 'application-button-label' });
            this.buttonbox.add(this.label, { y_align: St.Align.MIDDLE, y_fill: false });
        }
        this.actor.set_child(this.buttonbox);
        this._clickEventId = this.actor.connect('clicked', Lang.bind(this, onclick));
        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
    },
    _onDestroy: function () {
        if (this._clickEventId)
            this.actor.disconnect(this._clickEventId);
    }
};
Signals.addSignalMethods(BaseButton.prototype);


function ToggleSwitch(state) {
    this._init(state);
}
ToggleSwitch.prototype = {
    __proto__: PopupMenu.Switch.prototype,
    _init: function (state) {
        PopupMenu.Switch.prototype._init.call(this, state);
        this.actor.can_focus = true;
        this.actor.reactive = true;
        this.actor.add_style_class_name("config-menu-toggle-switch");
        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
        this.actor.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));
        this.actor.connect('key-focus-in', Lang.bind(this, this._onKeyFocusIn));
        this.actor.connect('key-focus-out', Lang.bind(this, this._onKeyFocusOut));
    },
    _onButtonReleaseEvent: function (actor, event) {
        this.toggle();
        return true;
    },
    _onKeyPressEvent: function (actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this.toggle();
            return true;
        }
        return false;
    },
    _onKeyFocusIn: function (actor) {
        actor.add_style_pseudo_class('active');
    },
    _onKeyFocusOut: function (actor) {
        actor.remove_style_pseudo_class('active');
    },
    getState: function () {
        return this.state;
    }
};