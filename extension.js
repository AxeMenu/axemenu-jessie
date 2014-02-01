/**TODO:
    1. Activites button position
 */
const Version = '0.8.3';
const ShellVersion = imports.misc.config.PACKAGE_VERSION.split(".");
const Mainloop = imports.mainloop;
const GMenu = imports.gi.GMenu;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const ModalDialog = imports.ui.modalDialog;
const AppFavorites = imports.ui.appFavorites;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GnomeSession = imports.misc.gnomeSession;
const Cairo = imports.cairo;
const GLib = imports.gi.GLib;
const Signals = imports.signals;
const Layout = imports.ui.layout;
const Gettext = imports.gettext;
const Pango = imports.gi.Pango;
const PlaceDisplay = imports.ui.placeDisplay;

const _ = imports.gettext.domain('axemenu').gettext;

let appsys = Shell.AppSystem.get_default();
let _session = new GnomeSession.SessionManager();

//Why are functions renames without creating a deprecated pointer..?
const cleanActor = (ShellVersion[1]<4) ? function(o) {return o.destroy_children();} : function(o) {return o.destroy_all_children();};
const insert_actor_to_box = (ShellVersion[1]<4) ? function(box,actor,position) {return box.insert_actor(actor,position);} : function(box,actor,position) {return box.insert_child_at_index(actor,position);};
const TextDirection = (ShellVersion[1]<4) ? St.TextDirection.LTR : Clutter.TextDirection.LTR ;
const getTextDirection = (ShellVersion[1]<4) ? function(actor) {return actor.get_direction();} : function(actor) {return actor.get_text_direction();};

function ApplicationButton(app,iconsize) {
    this._init(app,iconsize);
}
ApplicationButton.prototype = {
    _init: function(app,iconsize) {
        this.app = app;
        this.actor = new St.Button({ reactive: true, label: this.app.get_name(), style_class: 'application-button', x_align: St.Align.START });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        let labelclass = AppFavorites.getAppFavorites().isFavorite(app.get_id())?'application-button-label-favorites':'application-button-label';
        this.label = new St.Label({ text: this.app.get_name(), style_class: labelclass });
        this.icon = this.app.create_icon_texture(iconsize);
        this.buttonbox.add_actor(this.icon);
        this.buttonbox.add(this.label, { y_align: St.Align.MIDDLE, y_fill: false });
        this.actor.set_child(this.buttonbox);
        this._releaseEventId = this.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));
        this._clickEventId = this.actor.connect('clicked', Lang.bind(this, function() {
            this.app.open_new_window(-1);
            appsMenuButton.menu.close();
        }));
        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
    },
    _onButtonRelease: function(actor, event){
        let button = event.get_button();
        if (button == 3) {
            if ( this._confirmDialog == null ) {
                this._confirmDialog = new confirmDialog(this.app);
            }
            this._confirmDialog.open();
        }
    },
    _onDestroy : function() {
        if (this._clickEventId) this.actor.disconnect(this._clickEventId);
        if (this._releaseEventId) this.actor.disconnect(this._releaseEventId);
    }
};
Signals.addSignalMethods(ApplicationButton.prototype);

function confirmDialog(app) {
    this._init(app);
}
confirmDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,
    _init: function(app) {
        ModalDialog.ModalDialog.prototype._init.call(this, { styleClass: 'confirm-dialog' });
        this._app = app;
        this.apFav = AppFavorites.getAppFavorites();
        this.is_fav = this.apFav.isFavorite(app.get_id());
        let headLabel = this.is_fav?_("Remove \"%s\" from favorites?"):_("Add \"%s\" to favorites?");
        let header = new St.Label({ style_class: 'config-dialog-header', text: headLabel.format(this._app.get_name()) });
        this.contentLayout.add(header, { expand: true, x_fill: false, y_fill: false, x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
        let buttons = [{ action: Lang.bind(this, this._processApp),label:  _("Yes") }, { action: Lang.bind(this, this._closeModal),label:  _("No") }];
        this.setButtons(buttons);
        this._buttonLayout.style = ("padding-top: 50px;");
        this._actionKeys[Clutter.KEY_Escape] = Lang.bind(this, this._closeModal);
    },
    _processApp: function(){
        if(this.is_fav)
            this.apFav.removeFavorite(this._app.get_id());
        else
            this.apFav.addFavorite(this._app.get_id());
        this.close();
    },
    _closeModal: function(){
        this.close();
    }
};

function BaseButton(label,icon,iconsize,icontype,onclick) {
    this._init(label,icon,iconsize,icontype,onclick);
}
BaseButton.prototype = {
    _init: function(label,icon,iconsize,icontype,onclick) {
        this.actor = new St.Button({ reactive: true, label: label, style_class: 'application-button am-'+icon+'-button', x_align: St.Align.START });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        icontype = (icontype)?icontype:St.IconType.SYMBOLIC;
        if(icon){
            this.icon = new St.Icon({icon_name: icon, icon_size: iconsize, icon_type: icontype});
            this.buttonbox.add_actor(this.icon);
        }
        if(label){
            this.label = new St.Label({ text: label, style_class: 'application-button-label' });
            this.buttonbox.add(this.label, { y_align: St.Align.MIDDLE, y_fill: false });
        }
        this.actor.set_child(this.buttonbox);
        this._clickEventId = this.actor.connect('clicked', Lang.bind(this, onclick));
        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
    },
    _onDestroy : function() {
        if (this._clickEventId)
            this.actor.disconnect(this._clickEventId);
    }
};
Signals.addSignalMethods(BaseButton.prototype);

function PlaceButton(place, button_name,iconSize) {
    this._init(place, button_name,iconSize);
}
PlaceButton.prototype = {
    _init: function(place, button_name,iconSize) {
        this.place = place;
        this.button_name = button_name;
        this.actor = new St.Button({ reactive: true, label: this.button_name, style_class: 'application-button', x_align: St.Align.START });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        this.label = new St.Label({ text: this.button_name, style_class: 'application-button-label' });
        this.icon = place.iconFactory(iconSize);
        if(!this.icon) this.icon = new St.Icon({icon_name: 'error', icon_size: iconSize, icon_type: St.IconType.FULLCOLOR});
        this.buttonbox.add_actor(this.icon);
        this.buttonbox.add(this.label, { y_align: St.Align.MIDDLE, y_fill: false });
        this.actor.set_child(this.buttonbox);
        this.actor.connect('clicked', Lang.bind(this, function() {
            this.place.launch();
            appsMenuButton.menu.close();
        }));
        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
    },
    _onDestroy : function() {
        if (this._clickEventId)
            this.actor.disconnect(this._clickEventId);
    }
};
Signals.addSignalMethods(PlaceButton.prototype);

function CategoryButton(parent,category,iconSize) {
    this._init(parent,category,iconSize);
}
CategoryButton.prototype = {
    _init: function(parent,category,iconSize) {
        var label;
        this._parent = parent;
        this.category = category;
        if (category){
           this.menu_id = this.category.get_menu_id();
           let icon = category.get_icon();
           if (icon && icon.get_names)
               this.icon_name = icon.get_names().toString();
           else
               this.icon_name = "";
           label = category.get_name();
        }else{
            label = _("All applications");
            this.menu_id = '';
        }
        this.actor = new St.Button({ reactive: true, label: label, style_class: 'category-button', x_align: St.Align.START });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        this.label = new St.Label({ text: label, style_class: 'category-button-label' });
        if (category && this.icon_name){
           this.icon = new St.Icon({icon_name: this.icon_name, icon_size: iconSize, icon_type: St.IconType.FULLCOLOR});
           
        }else{
            this.icon = new St.Icon({icon_name: 'start-here', icon_size: iconSize, icon_type: St.IconType.SYMBOLIC});
        }
        this.buttonbox.add_actor(this.icon);
        this.buttonbox.add(this.label, { y_align: St.Align.MIDDLE, y_fill: false });
        this.actor.set_child(this.buttonbox);

        this._clickEventId = this.actor.connect('clicked', Lang.bind(this, function() {
            this._parent._select_category(this.category, this);
            this._parent.cm.set_val('category_menu_id', this.menu_id);
            this._parent._scrollToCatButton(this);
            this._parent.selectedAppTitle.set_text("");
            this._parent.selectedAppDescription.set_text("");
        }));
        if(!parent.cm.click_on_category)
            this._parent._addEnterEvent(this, Lang.bind(this, function() {
                this._parent._select_category(this.category, this);
                this._parent.cm.set_val('category_menu_id', this.menu_id);
                this._parent.selectedAppTitle.set_text("");
                this._parent.selectedAppDescription.set_text("");
            }));
        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
    },
    _onDestroy : function() {
        if (this._clickEventId)
            this.actor.disconnect(this._clickEventId);
    }
};

Signals.addSignalMethods(CategoryButton.prototype);

function FavoritesButton(app,iconSize,favoritesText) {
    this._init(app,iconSize,favoritesText);
}
FavoritesButton.prototype = {
    _init: function(app,iconSize,favoritesText) {
        this._app = app;
        this.actor = new St.Button({ reactive: true, style_class: 'applications-menu-favorites-button', x_align: favoritesText?St.Align.START:St.Align.MIDDLE });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        this.icon = this._app.create_icon_texture(iconSize);
        this.buttonbox.add_actor(this.icon);
        if(favoritesText){
            this.label = new St.Label({ text: this._app.get_name(), style_class: 'favorites-button-label' });
            this.buttonbox.add(this.label, { y_align: St.Align.MIDDLE, y_fill: false });
        }
        this.actor.set_child(this.buttonbox);
        this._releaseEventId = this.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));
        this._clickEventId = this.actor.connect('clicked', Lang.bind(this, function() {
            this._app.open_new_window(-1);
            appsMenuButton.menu.close();
        }));
        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
    },
    _onButtonRelease: function(actor, event){
        let button = event.get_button();
        if (button == 3) {
            if ( this._confirmDialog == null ) {
                this._confirmDialog = new confirmDialog(this._app);
            }
            this._confirmDialog.open();
        }
    },
    _onDestroy : function() {
        if (this._clickEventId) this.actor.disconnect(this._clickEventId);
        if (this._releaseEventId) this.actor.disconnect(this._releaseEventId);
    }
};
Signals.addSignalMethods(FavoritesButton.prototype);

function ConfigManager(parent) {
    this._init(parent);
}
ConfigManager.prototype = {
    _init: function(parent) {
        this.config_file = this._initConfigFile();
        this._conf = {};
        this.parent = parent;
    },
    get_val: function(key, defaultValue) {
        return (this._conf[key]==undefined)?defaultValue:this._conf[key];
    },
    get_enum: function(key, defaultValue) {
        let res;
        try {
            res = this._conf[key].split(',');
        } catch (e) {
            res = defaultValue;
        }
        return res;
    },
    set_val: function(key,value) {
        this._conf[key] = value;
    },
    _initConfigFile: function(){
        let filename;
        if (!GLib.file_test(GLib.get_home_dir() + '/.config', GLib.FileTest.EXISTS)) {
            filename = GLib.get_home_dir() + '/.axemenu.conf';
        }else{
            filename = GLib.get_home_dir() + '/.config/axemenu.conf';
        }
        if (!GLib.file_test(filename, GLib.FileTest.EXISTS)) {
            this._createDefaultConfig(filename);
        }
        return filename;
    },
    _createDefaultConfig: function(filename){
        let default_content = "{}";
        GLib.file_set_contents(filename, default_content, default_content.length);
    },
    implode:function( glue, pieces ) {
        return ( ( pieces instanceof Array ) ? pieces.join ( glue ) : pieces );
    },
    loadConfig: function() {
        let data = GLib.file_get_contents(this.config_file)[1].toString();
        this._conf = JSON.parse(data);
        this.display_activites = this.get_val('display_activites', true);
        this.activites_position = this.get_val('activites_position', false);
        this.defaultBookmarksCount = this.parent.placesManager.getBookmarks().length>5?5:0;
        this.defaultBookmarksCount = 5;
        this.defaultFavColumns = global.settings.get_strv('favorite-apps').length>12?3:2;
        Main.panel._rightBox.remove_actor(activitiesButton.actor);
        if(this.display_activites) {
            let actpos = this.activites_position?Main.panel._rightBox.get_children().length:0;
            insert_actor_to_box(Main.panel._rightBox,activitiesButton.actor, actpos);
        }else{
            Main.panel._rightBox.remove_actor(activitiesButton.actor);
        }
        this.button_label = decodeURIComponent(this.get_val('button_label', _("Menu")));
        this.display_icon = this.get_val('display_icon', true);
        this.is_hot_corner = this.get_val('is_hot_corner', true);
        if(!this.is_hot_corner){
            this.parent._hotCorner.actor.hide();
            activitiesButton._hotCorner.actor.show();
        }else{
            this.parent._hotCorner.actor.show();
            activitiesButton._hotCorner.actor.hide();
        }
        this.icon_name = this.get_val('icon_name', 'start-here');
        this.parent._icon.set_icon_name(this.icon_name);
        this.start_with_fav = this.get_val('start_with_fav', true);
        if(!this.display_icon)
            this.parent._iconBox.hide();
        else
            this.parent._iconBox.show();
        if(this.button_label!=''){
            this.parent._label.set_text(this.button_label);
            this.parent._label.show();
        }else{
            this.parent._label.hide();
        }
        
        this.main_icon_size = this.get_val('main_icon_size', 18);
        this.parent._icon.set_icon_size(this.main_icon_size);
        this.main_box_width = this.get_val('main_box_width', 705);
        this.left_pane_width = this.get_val('left_pane_width', 165);
        this.display_places = this.get_val('display_places', true);
        this.display_bookmarks = this.get_val('display_bookmarks', true);
        this.display_system = this.get_val('display_system', true);
        this.display_search = this.get_val('display_search', true);
        this.system_apps = this.get_enum('system_apps',['gnome-control-center','gnome-terminal']);
        this.display_shutdown = this.get_val('display_shutdown', true);
        this.show_left_pane =  this.get_val('show_left_pane', true);
        this.show_bottom_pane = this.get_val('show_bottom_pane', true);
        this.max_bookmarks = this.get_val('max_bookmarks',this.defaultBookmarksCount);
        this.searchentry_width = this.get_val('searchentry_width', 240);
        this.favorites_text = this.get_val('favorites_text', true);
        this.favorites_columns = this.get_val('favorites_columns',this.defaultFavColumns);
        this.favorites_icon_size = this.get_val('favorites_icon_size',68);
        this.category_with_scroll = this.get_val('category_with_scroll', false);
        this.category_icon_size = this.get_val('category_icon_size',24);
        this.leftpane_icon_size = this.get_val('leftpane_icon_size',22);
        this.application_icon_size = this.get_val('application_icon_size',32);
        this.categories_box_width = this.get_val('categories_box_width',180);
        this.smart_height = this.get_val('smart_height', true);
        this.axe_in_hotcorner = this.get_val('axe_in_hotcorner', false);
        this.click_on_category = this.get_val('click_on_category', false);
        this.search_tool = decodeURIComponent(this.get_val('search_tool', "gnome-search-tool"));
        this.stored_category_id = this.get_val('category_menu_id', null);
    },
    saveConfig: function() {
        GLib.file_set_contents(this.config_file, JSON.stringify(this._conf), -1);
    },
    resetToDefault: function() {
        GLib.file_set_contents(this.config_file, '{}', -1);
        this.parent.reDisplay();
    },
    destroy: function() {

    }
};

function ToggleSwitch(state) {
    this._init(state);
}
ToggleSwitch.prototype = {
    __proto__: PopupMenu.Switch.prototype,
    _init: function(state) {
        PopupMenu.Switch.prototype._init.call(this, state);
        this.actor.can_focus = true;
        this.actor.reactive = true;
        this.actor.add_style_class_name("config-menu-toggle-switch");
        this.actor.connect('button-release-event', Lang.bind(this, this._onButtonReleaseEvent));
        this.actor.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));
        this.actor.connect('key-focus-in', Lang.bind(this, this._onKeyFocusIn));
        this.actor.connect('key-focus-out', Lang.bind(this, this._onKeyFocusOut));
    },
    _onButtonReleaseEvent: function(actor, event) {
        this.toggle();
        return true;
    },
    _onKeyPressEvent: function(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this.toggle();
            return true;
        }
        return false;
    },
    _onKeyFocusIn: function(actor) {
        actor.add_style_pseudo_class('active');
    },
    _onKeyFocusOut: function(actor) {
        actor.remove_style_pseudo_class('active');
    },
    getState: function() {
        return this.state;
    }
};

function NB() {
    this._init();
}
NB.prototype = {
    _init: function() {
        this.actor = new St.BoxLayout({styleClass: 'config-notebook-box'});
        this.actor._delegate = this;
        this.tabsControls = new St.BoxLayout({vertical: true,styleClass: 'config-notebook-tabs' });
        this.actor.add(this.tabsControls);
        this.pagesControls = new St.BoxLayout();
        this.actor.add(this.pagesControls, { expand: true, x_fill: true, y_fill: false, y_align: St.Align.START });
        this._tabs = new Array();
    },
    addTab: function(title) {
        let tab = new BaseButton(title,null,0,0,function(){
            this.tabsControls.get_children().forEach(function(c) { c.style_class = "application-button" });
            this.actor.style_class = "application-button-selected";
            this.pagesControls.get_children().forEach(function(c) { c.hide() });
            this.controlsBox.show();
        });
        this.tabsControls.add(tab.actor);
        let controlsBox = new St.BoxLayout({styleClass: 'config-notebook-control-box', vertical: true });
        this.pagesControls.add(controlsBox, { expand: true, x_fill: true, y_fill: false, y_align: St.Align.START });
        controlsBox.hide();
        tab.controlsBox = controlsBox;
        tab.tabsControls = this.tabsControls;
        tab.pagesControls = this.pagesControls;
        this._tabs.push(tab);
        return controlsBox;
    },
    showTab: function(index) {
        this._tabs[index].actor.emit('clicked',1);
    },
    clean: function () {
        this._tabs = new Array();
        cleanActor(this.tabsControls);
        this.pagesControls.get_children().forEach(function(c) { cleanActor(c) });
        cleanActor(this.pagesControls);
    }
};
Signals.addSignalMethods(NB.prototype);

function MicroHighlighter(parent,text, lineWrap, allowMarkup) {
    this._init(parent,text, lineWrap, allowMarkup);
}
//from ui/messageTray.js
MicroHighlighter.prototype = {
    _init: function(parent,text, lineWrap, allowMarkup) {
        if (!text)
            text = '';
        this._urlRegexp = new RegExp('(\\[url=(.+)\\](.+)\\[/url\\])', 'gi');
        this._parent = parent;
        this.actor = new St.BoxLayout();
        this.label = new St.Label({ reactive: true });
        this.actor.add(this.label);
        this._linkColor = '#ccccff';
        this.label.connect('style-changed', Lang.bind(this, function() {
            let [hasColor, color] = this.label.get_theme_node().lookup_color('link-color', false);
            if (hasColor) {
                let linkColor = color.to_string().substr(0, 7);
                if (linkColor != this._linkColor) {
                    this._linkColor = linkColor;
                    this.setMarkup(text, allowMarkup);
                }
            }
        }));
        if (lineWrap) {
            this.label.clutter_text.line_wrap = true;
            this.label.clutter_text.line_wrap_mode = Pango.WrapMode.WORD_CHAR;
            this.label.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
        }
        this.setMarkup(text, allowMarkup);
        this.label.connect('button-press-event', Lang.bind(this, function(actor, event) {
            if (!actor.visible || actor.get_paint_opacity() == 0)
                return false;
            return this._findUrlAtPos(event) != -1;
        }));
        this.label.connect('button-release-event', Lang.bind(this, function (actor, event) {
            if (!actor.visible || actor.get_paint_opacity() == 0)
                return false;
            let urlId = this._findUrlAtPos(event);
            if (urlId != -1) {
                Gio.app_info_launch_default_for_uri(this._urls[urlId].url, global.create_app_launch_context());
                this._parent.close();
                return true;
            }
            return false;
        }));
        this.label.connect('motion-event', Lang.bind(this, function(actor, event) {
            if (!actor.visible || actor.get_paint_opacity() == 0)
                return false;
            let urlId = this._findUrlAtPos(event);
            if (urlId != -1 && !this._cursorChanged) {
                global.set_cursor(Shell.Cursor.POINTING_HAND);
                this._cursorChanged = true;
            } else if (urlId == -1) {
                global.unset_cursor();
                this._cursorChanged = false;
            }
            return false;
        }));
        this.label.connect('leave-event', Lang.bind(this, function() {
            if (!this.label.visible || this.label.get_paint_opacity() == 0)
                return;
            if (this._cursorChanged) {
                this._cursorChanged = false;
                global.unset_cursor();
            }
        }));
    },
    _fixMarkup: function(text, allowMarkup) {
        if (allowMarkup) {
            let _text = text.replace(/&(?!amp;|quot;|apos;|lt;|gt;)/g, '&amp;');
            _text = _text.replace(/<(?!\/?[biu]>)/g, '&lt;');
            try {
                Pango.parse_markup(_text, -1, '');
                return _text;
            } catch (e) {}
        }
        return GLib.markup_escape_text(text, -1);
    },
    setMarkup: function(text, allowMarkup) {
        text = text ? this._fixMarkup(text, allowMarkup) : '';
        this._text = text;
        this.label.clutter_text.set_markup(text);
        /* clutter_text.text contain text without markup */
        this._urls = this.findUrls(this.label.clutter_text.text);
        this._highlightUrls();
    },
    findUrls: function(str) {
        let res = [], match;
        while ((match = this._urlRegexp.exec(str)))
            res.push({ url: match[2], pos: match.index, text: match[3], urllength: match[0].length });
        return res;
    },
    _highlightUrls: function() {
        // text here contain markup
        let urls = this.findUrls(this._text);
        let markup = '';
        let pos = 0;
        let delta = 0;
        for (let i = 0; i < urls.length; i++) {
            let url = urls[i];
            let str = this._text.substr(pos, url.pos - pos);
            markup += str + '<span foreground="'+this._linkColor+'" size="x-small"><u>' + url.text + '</u></span>';
            pos = url.pos + url.urllength;
            this._urls[i].pos -= delta;
            delta += this._urls[i].urllength-this._urls[i].text.length;
        }
        markup += this._text.substr(pos);
        this.label.clutter_text.set_markup(markup);
    },
    _findUrlAtPos: function(event) {
        let success;
        let [x, y] = event.get_coords();
        [success, x, y] = this.label.transform_stage_point(x, y);
        let find_pos = -1;
        for (let i = 0; i < this.label.clutter_text.text.length; i++) {
            let [success, px, py, line_height] = this.label.clutter_text.position_to_coords(i);
            if (py > y || py + line_height < y || x < px)
                continue;
            find_pos = i;
        }
        if (find_pos != -1) {
            for (let i = 0; i < this._urls.length; i++)
            if (find_pos >= this._urls[i].pos && this._urls[i].pos + this._urls[i].text.length > find_pos)
                return i;
        }
        return -1;
    }
};

function ConfigDialog(ConfigManager) {
    this._init(ConfigManager);
}
ConfigDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,
    _init: function(ConfigManager) {
        ModalDialog.ModalDialog.prototype._init.call(this, { styleClass: 'config-menu-dialog' });
        this._dialogLayout.style=("padding: 18px 25px 35px 25px;");
        this._buttonLayout.style = ("padding-top: 0px;");
        this.cm = ConfigManager;
        this.notebook = new NB();
        let monitor = Main.layoutManager.primaryMonitor;
        let buttons = [{ action: Lang.bind(this, this.save_settings),label:  _("Save") }, { action: Lang.bind(this, this.apply_settings),label:  _("Apply") }, { action: Lang.bind(this, this.close),label:  _("Cancel") }];
        this.setButtons(buttons);
        this._actionKeys[Clutter.KEY_Escape] = Lang.bind(this, this.close);
        this.header = new St.Label({ style_class: 'config-dialog-header nb', text: _("AxeMenu settings") });
        this.contentLayout.add(this.header, { expand: true, x_fill: true, y_fill: false, x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
        this.contentLayout.add(this.notebook.actor, { expand: true, x_fill: true, y_fill: false });
        
    },
    _addSwith: function(parent,text, value) {
        let label = new St.Label({ style_class: 'config-dialog-label', text: _(text) });
        let box = new St.BoxLayout({vertical:    false});
        box.add(label, { expand: true, x_fill: false, y_fill: false, x_align: St.Align.START, y_align: St.Align.MIDDLE });
        let switchcontrol = new ToggleSwitch(value);
        box.add_actor(switchcontrol.actor, { expand: true, x_fill: false, y_fill: false, x_align: St.Align.END, y_align: St.Align.MIDDLE });
        parent.add(box,{expand: true});
        return switchcontrol;
    },
    _addEntry: function(parent,text, value, classname,vertical,textual) {
        let label = new St.Label({ style_class: 'config-dialog-label', text: _(text) });
        vertical = vertical?vertical:false;
        let box = new St.BoxLayout({ vertical:    vertical});
        box.add(label, { expand: true, x_fill: false, y_fill: false, x_align: St.Align.START, y_align: St.Align.MIDDLE });
        classname = classname?"config-dialog-entry "+classname:"config-dialog-entry";
        let entrycontrol = new St.Entry({style_class: classname, text: value.toString()});
        if(!textual) {
            entrycontrol.connect('scroll-event',
                               Lang.bind(this, this._onScroll));
        }
        
        box.add(entrycontrol, { expand: true, x_fill: vertical, y_fill: false, x_align: St.Align.END, y_align: St.Align.MIDDLE });
        parent.add(box);
        return entrycontrol;
    },
    _addButton: function(parent,text,buttontext,callback){
        let label = new St.Label({ style_class: 'config-dialog-label', text: _(text) });
        let box = new St.BoxLayout({vertical: false, style: "padding-top: 50px;"});
        box.add(label, { expand: true, x_fill: false, y_fill: false, x_align: St.Align.START, y_align: St.Align.MIDDLE });
        let button = new BaseButton(_(buttontext),null,0,0,callback);
        button.actor.add_style_class_name('button-reset');
        box.add(button.actor, { expand: true, x_fill: false, y_fill: false, x_align: St.Align.END, y_align: St.Align.MIDDLE });
        parent.add(box);
        return button;
    },
    _initControls: function(activetab) {
        let tab = this.notebook.addTab(_('Main'));
        this.ButtonLabel = this._addEntry(tab,'Button label',this.cm.button_label,'config-button-label-entry',false,true);
        this.displayIconSwitch = this._addSwith(tab,'"Menu" button with icon',this.cm.display_icon);
        this.MainIconEntry = this._addEntry(tab,'Main icons size (px)',this.cm.main_icon_size);
        this.hotCornerSwitch = this._addSwith(tab,'Hot corner',this.cm.is_hot_corner);
        this.axeCornerSwitch = this._addSwith(tab,'AxeMenu in Hot corner',this.cm.axe_in_hotcorner);
        this.IconNameEntry = this._addEntry(tab,'Icon name',this.cm.icon_name,'config-button-label-entry',false,true);
        this.displayActivitesSwitch = this._addSwith(tab,'Display Activites button',this.cm.display_activites);
        this.activitesPositionSwitch = this._addSwith(tab,'Activites button rightmost',this.cm.activites_position);
        this.mainBoxWidthEntry = this._addEntry(tab,'Main menu width (px)',this.cm.main_box_width);
        this.smartHeightSwitch = this._addSwith(tab,'Fixed height of menu',this.cm.smart_height);
        this.startWithFavSwitch = this._addSwith(tab,'Start with favorites',this.cm.start_with_fav);

        tab = this.notebook.addTab(_('Left pane'));
        this.showLeftSwitch = this._addSwith(tab,'Display Left pane',this.cm.show_left_pane);
        this.LeftBoxWidthEntry = this._addEntry(tab,'Left pane width (px)',this.cm.left_pane_width);
        this.MaxBookmarksEntry = this._addEntry(tab,'Max bookmarks count (zero for show all)',this.cm.max_bookmarks);
        this.LeftIconEntry = this._addEntry(tab,'Left pane icons size (px)',this.cm.leftpane_icon_size);
        this.displayPlacesSwitch = this._addSwith(tab,'Display Places section',this.cm.display_places);
        this.displayBookmarksSwitch = this._addSwith(tab,'Display Bookmarks section',this.cm.display_bookmarks);
        this.displaySystemSwitch = this._addSwith(tab,'Display System section',this.cm.display_system);
        this.displaySearchSwitch = this._addSwith(tab,'Display Search button',this.cm.display_search);
        this.displayShutdownSwitch = this._addSwith(tab,'Display Shutdown section',this.cm.display_shutdown);
        this.SearchToolEntry = this._addEntry(tab,'Search tool',this.cm.search_tool,'config-button-label-entry',false,true);

        tab = this.notebook.addTab(_('Right pane'));
        this.SearchWidthEntry = this._addEntry(tab,'Width of search entry (px)',this.cm.searchentry_width);
        this.FavTextSwitch = this._addSwith(tab,'Favorites has label',this.cm.favorites_text);
        this.FavColEntry = this._addEntry(tab,'Favorites columns count',this.cm.favorites_columns);
        this.FavIconEntry = this._addEntry(tab,'Favorites icons size (px)',this.cm.favorites_icon_size);
        this.clickOnCategorySwitch = this._addSwith(tab,'Select Category by click',this.cm.click_on_category);
        this.catWithScrollSwitch = this._addSwith(tab,'Categories box has scroll',this.cm.category_with_scroll);
        this.CatIconEntry = this._addEntry(tab,'Category icons size (px)',this.cm.category_icon_size);
        this.AppIconEntry = this._addEntry(tab,'Applications icons size (px)',this.cm.application_icon_size);
        this.CatBoxWidthEntry = this._addEntry(tab,'Categories box width (px)',this.cm.categories_box_width);

        tab = this.notebook.addTab(_('Additionally'));
        this.showBottomSwitch = this._addSwith(tab,'Display bottom pane',this.cm.show_bottom_pane);
        this.SysAppsEntry = this._addEntry(tab,'System Applications (Left pane)',this.cm.system_apps,"sysapps",true);
        this._addButton(tab,'Reset to default','Reset',function(){
            appsMenuButton._configDialog.resetToDefault();
        });
        tab = this.notebook.addTab(_('About'));
        let about = 'error';
        try {
            about = GLib.file_get_contents(extensionMeta.path+"/ABOUT")[1].toString();
            about = about.replace('@version@', Version).replace('@e.g.o-version@',egoVersion);
        }catch(e){}

        let aboutText = new MicroHighlighter(this,about,false,true);
        let aboutScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'vfade about-scrollbox', height: 350 });
        aboutScrollBox.add_actor(aboutText.actor);
        tab.add(aboutScrollBox);
        this.notebook.showTab(activetab);
    },
    _onScroll: function (actor, event) {
        let direction = event.get_scroll_direction();
        let pint = parseInt(actor.get_text());
        if (direction == Clutter.ScrollDirection.UP) {
            ++pint;
        } else if (direction == Clutter.ScrollDirection.DOWN) {
            --pint;
        }
        pint = pint<0?0:pint;
        actor.set_text(pint.toString());
    },
    _setInt: function(entry, defval) {
        let pint = parseInt(entry.get_text());
        return pint!=NaN && pint>=0?pint:defval;
    },
    apply_settings: function (){
        this.cm.set_val('button_label',encodeURIComponent(this.ButtonLabel.get_text()),_("Menu"));
        this.cm.set_val('display_icon',this.displayIconSwitch.state,true);
        this.cm.set_val('is_hot_corner',this.hotCornerSwitch.state,true);
        this.cm.set_val('icon_name',this.IconNameEntry.get_text(),'start-here');
        this.cm.set_val('main_icon_size',this._setInt(this.MainIconEntry,18));
        this.cm.set_val('start_with_fav',this.startWithFavSwitch.state,true);
        this.cm.set_val('show_bottom_pane',this.showBottomSwitch.state,true);
        this.cm.set_val('display_activites',this.displayActivitesSwitch.state,true);
        this.cm.set_val('activites_position',this.activitesPositionSwitch.state,false);
        this.cm.set_val('main_box_width',this._setInt(this.mainBoxWidthEntry,705));
        this.cm.set_val('left_pane_width',this._setInt(this.LeftBoxWidthEntry,165));
        this.cm.set_val('display_places',this.displayPlacesSwitch.state,true);
        this.cm.set_val('display_bookmarks',this.displayBookmarksSwitch.state,true);
        this.cm.set_val('display_system',this.displaySystemSwitch.state,true);
        this.cm.set_val('display_search',this.displaySearchSwitch.state,true);
        this.cm.set_val('system_apps',this.cm.implode(',',this.SysAppsEntry.get_text()));
        this.cm.set_val('display_shutdown',this.displayShutdownSwitch.state,true);
        this.cm.set_val('show_left_pane',this.showLeftSwitch.state,true);
        this.cm.set_val('max_bookmarks',this._setInt(this.MaxBookmarksEntry,this.cm.defaultBookmarksCount));
        this.cm.set_val('searchentry_width',this._setInt(this.SearchWidthEntry,240));
        this.cm.set_val('favorites_text',this.FavTextSwitch.state,true);
        this.cm.set_val('favorites_columns',this._setInt(this.FavColEntry,this.cm.defaultFavColumns));
        this.cm.set_val('favorites_icon_size',this._setInt(this.FavIconEntry,68));
        this.cm.set_val('category_with_scroll',this.catWithScrollSwitch.state,false);
        this.cm.set_val('category_icon_size',this._setInt(this.CatIconEntry,24));
        this.cm.set_val('leftpane_icon_size',this._setInt(this.LeftIconEntry,22));
        this.cm.set_val('application_icon_size',this._setInt(this.AppIconEntry,32));
        this.cm.set_val('categories_box_width',this._setInt(this.CatBoxWidthEntry,180));
        this.cm.set_val('smart_height',this.smartHeightSwitch.state,true);
        this.cm.set_val('axe_in_hotcorner',this.axeCornerSwitch.state,false);
        this.cm.set_val('click_on_category',this.clickOnCategorySwitch.state,false);
        this.cm.set_val('search_tool',encodeURIComponent(this.SearchToolEntry.get_text()),"gnome-search-tool");
        this.cm.saveConfig();
    },
    resetToDefault: function(){
        this.notebook.clean();
        this.cm.resetToDefault();
        this._initControls(0);
    },
    save_settings: function (){
        this.apply_settings();
        this.close();
    },
    open: function() {
        this._initControls(0);
        ModalDialog.ModalDialog.prototype.open.call(this, global.get_current_time());
    },
    close: function() {
        this.notebook.clean();
        global.unset_cursor();
        ModalDialog.ModalDialog.prototype.close.call(this, global.get_current_time());
    }
};

function AxeButton(menuAlignment) {
    this._init(menuAlignment);
}
AxeButton.prototype = {
    __proto__: PanelMenu.ButtonBox.prototype,
    _init: function(menuAlignment) {
        PanelMenu.ButtonBox.prototype._init.call(this, { reactive: true, can_focus: true, track_hover: true });
        this.actor.connect('button-press-event', Lang.bind(this, this._onButtonPress));
        this.actor.connect('key-press-event', Lang.bind(this, this._onSourceKeyPress));
        this._menuAlignment = menuAlignment;
        this._resetMenu();
        if(ShellVersion[1]<4){
            //gconftool-2 -s --type string "/apps/metacity/global_keybindings/run_command_12" 'Super_R'
            global.window_manager.takeover_keybinding('run_command_12');
            this._keyBindingId = global.window_manager.connect('keybinding::run_command_12', function() {
                appsMenuButton.toggleMenu();
            });
        }else{
            global.display.add_keybinding('axemenu-toggle', this._getSettings(), 0, function() {
                appsMenuButton.toggleMenu();
            });
        }
    },
    _getSettings: function() {
        let source = Gio.SettingsSchemaSource.new_from_directory(extensionMeta.path+"/schemas", Gio.SettingsSchemaSource.get_default(), false);
        let schema = source.lookup('org.gnome.shell.extensions.axemenu.keybindings', false);
        return new Gio.Settings({settings_schema: schema});
    },
    toggleMenu: function(){
        if (!this.menu.isOpen) {
            let monitor = Main.layoutManager.primaryMonitor;
            this.menu.actor.style = ('max-height: ' + Math.round(monitor.height - Main.panel.actor.height-80) + 'px;');
        }else{
            this.reloadFlag = false;
            this.cm.saveConfig();
        }
        this.menu.toggle();
    },
    _resetMenu: function(){
        this.menu = new PopupMenu.PopupMenu(this.actor, this._menuAlignment, St.Side.TOP);
        this.menu.actor.add_style_class_name('application-menu-background');
        this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateChanged));
        Main.uiGroup.add_actor(this.menu.actor);
        this.menu.actor.hide();
        Main.panel._menus.addMenu(this.menu);
    },
    _onButtonPress: function(actor, event) {
        let button = event.get_button();
        if (button == 1) {
            this.toggleMenu();
        } else if (button == 3) {
            if ( this._configDialog == null ) {
                this._configDialog = new ConfigDialog(this.cm);
            }
            this._configDialog.open();
        }
    },
    _onSourceKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this.menu.toggle();
            return true;
        } else if (symbol == Clutter.KEY_Escape && this.menu.isOpen) {
            this.menu.close();
            return true;
        } else if (symbol == Clutter.KEY_Down) {
            if (!this.menu.isOpen)
                this.menu.toggle();
            this.menu.actor.navigate_focus(this.actor, Gtk.DirectionType.DOWN, false);
            return true;
        } else
            return false;
    },
    _onOpenStateChanged: function(menu, open) {
        if (open)
            this.actor.add_style_pseudo_class('active');
        else
            this.actor.remove_style_pseudo_class('active');
    },
    destroy: function() {
        
        this.actor._delegate = null;
        this._monitor.disconnect(this._monitorChangedId);
        this.menu.actor.get_children().forEach(function(c) { c.destroy() });
        this.menu.destroy();
        if(ShellVersion[1]<4)
            global.window_manager.disconnect(this._keyBindingId);
        else
            global.display.remove_keybinding('axemenu-toggle');
        this.actor.destroy();
    }
};
Signals.addSignalMethods(AxeButton.prototype);

function HotCorner(parent) {
    this._init(parent);
}
HotCorner.prototype = {
    __proto__: Layout.HotCorner.prototype,
    _init : function(parent) {
        this._parent = parent;
        Layout.HotCorner.prototype._init.call(this);
    },
    _onCornerEntered : function() {
        if (!this._entered) {
            this._entered = true;
            if (!Main.overview.animationInProgress) {
                this._activationTime = Date.now() / 1000;
                this.rippleAnimation();
                if(!this._parent.cm.axe_in_hotcorner){
                    Main.overview.toggle();
                }else{
                    this._parent.toggleMenu();
                }
            }
        }
        return false;
    }
};

function ApplicationsButton() {
    this._init();
}
ApplicationsButton.prototype = {
    __proto__: AxeButton.prototype,
    _init: function() {
        AxeButton.prototype._init.call(this, 1);
        let container = new Shell.GenericContainer();
        container.connect('get-preferred-width', Lang.bind(this, this._containerGetPreferredWidth));
        container.connect('get-preferred-height', Lang.bind(this, this._containerGetPreferredHeight));
        container.connect('allocate', Lang.bind(this, this._containerAllocate));
        this.actor.add_actor(container);
        this._box = new St.BoxLayout({ name: 'axeMenu' });
        this._iconBox = new St.Bin();
        this._box.add(this._iconBox, { y_align: St.Align.MIDDLE, y_fill: false });
        this._icon = new St.Icon({ icon_name: 'start-here', icon_size: 18, icon_type: St.IconType.SYMBOLIC, style_class: 'axemenu-icon' });
        this._iconBox.child = this._icon;
        this._label = new St.Label({ track_hover: true, style_class: 'application-menu-button-label'});
        this._box.add(this._label, { y_align: St.Align.MIDDLE, y_fill: false });
        this._label.set_text(_("Menu"));
        container.add_actor(this._box);
        this._hotCorner = new HotCorner(this);
        container.add_actor(this._hotCorner.actor);
        this._searchInactiveIcon = new St.Icon({ style_class: 'search-entry-icon', icon_name: 'edit-find', icon_type: St.IconType.SYMBOLIC });
        this._searchActiveIcon = new St.Icon({ style_class: 'search-entry-icon', icon_name: 'edit-clear', icon_type: St.IconType.SYMBOLIC });
        this._searchTimeoutId = 0;
        this._searchIconClickedId = 0;
        this._selectedItemIndex = null;
        this._favSelectedItemIndex = null;
        this._previousSelectedItemIndex = null;
        this._activeContainer = null;
        this.cm = new ConfigManager(this);
        this.reloadFlag = true;
        this.placesManager = new PlaceDisplay.PlacesManager();
        this._createLayout();
        this._display();
        _installedChangedId = appsys.connect('installed-changed', Lang.bind(this, this.reDisplay));
        _favoritesChangedId = AppFavorites.getAppFavorites().connect('changed', Lang.bind(this, this.reDisplay));
        _bookmarksChangedId = this.placesManager.connect('bookmarks-updated',Lang.bind(this,this.reDisplay));
        this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateToggled));
        this._monitor = Gio.file_new_for_path(this.cm.config_file).monitor(Gio.FileMonitorFlags.NONE, null);
        this._monitorChangedId = this._monitor.connect('changed', Lang.bind(this,this.reDisplay));
    },
    _containerGetPreferredWidth: function(actor, forHeight, alloc) {
        [alloc.min_size, alloc.natural_size] = this._box.get_preferred_width(forHeight);
    },
    _containerGetPreferredHeight: function(actor, forWidth, alloc) {
        [alloc.min_size, alloc.natural_size] = this._box.get_preferred_height(forWidth);
    },
    _containerAllocate: function(actor, box, flags) {
        this._box.allocate(box, flags);
        let primary = Main.layoutManager.primaryMonitor;
        let hotBox = new Clutter.ActorBox();
        let ok, x, y;
        if (getTextDirection(actor) == TextDirection) {
            [ok, x, y] = actor.transform_stage_point(primary.x, primary.y);
        } else {
            [ok, x, y] = actor.transform_stage_point(primary.x + primary.width, primary.y);
        }
        hotBox.x1 = Math.round(x);
        hotBox.x2 = hotBox.x1 + this._hotCorner.actor.width;
        hotBox.y1 = Math.round(y);
        hotBox.y2 = hotBox.y1 + this._hotCorner.actor.height;
        this._hotCorner.actor.allocate(hotBox, flags);
    },
    _createNetwork: function()
    {
        let button = new BaseButton(_("Network"),'network-workgroup',this.cm.leftpane_icon_size,St.IconType.FULLCOLOR,function() {
            Main.Util.spawnCommandLine("nautilus network:///");
            appsMenuButton.menu.close();
        });
        return button.actor;
    },
    _createSearch: function()
    {
        let button = new BaseButton(_("Search"),'edit-find',22,St.IconType.SYMBOLIC,function() {
            Main.Util.spawnCommandLine(appsMenuButton.cm.search_tool);
            appsMenuButton.menu.close();
        });
        return button.actor;
    },
    _createSettingsButton: function()
    {
        let buttonContainer = new St.BoxLayout({style: "padding: 10px 0 0 10px;",opacity: 120});
        let button = new BaseButton('','system-run',18,St.IconType.SYMBOLIC,function() {
            if ( appsMenuButton._configDialog == null ) {
                appsMenuButton._configDialog = new ConfigDialog(appsMenuButton.cm);
            }
            appsMenuButton._configDialog.open();
            appsMenuButton.menu.close();
        });
        button.actor.connect('enter-event', Lang.bind(this, function() {
                   this.selectedAppTitle.set_text(_("AxeMenu settings"));
                }));
        button.actor.connect('leave-event', Lang.bind(this, function() {
                   this.selectedAppTitle.set_text("");
                }));
        buttonContainer.add(button.actor);
        return buttonContainer;
    },
    _createComputer: function()
    {
        let button = new BaseButton(_("Computer"),'computer',this.cm.leftpane_icon_size,St.IconType.FULLCOLOR,function() {
            Main.Util.spawnCommandLine("nautilus computer://");
            appsMenuButton.menu.close();
        });
        return button.actor;
    },
    _createHome: function()
    {
        let button = new BaseButton(_("Home Folder"),'user-home',this.cm.leftpane_icon_size,St.IconType.FULLCOLOR,function() {
            Main.Util.spawnCommandLine("nautilus");
            appsMenuButton.menu.close();
        });
        return button.actor;
    },
    _createDesktop: function()
    {
        let button = new BaseButton(_("Desktop"),'user-desktop',this.cm.leftpane_icon_size,St.IconType.FULLCOLOR,function() {
            let desktop_folder = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP);
            Main.Util.spawnCommandLine("nautilus \"" + desktop_folder.replace(" ","\ ") + "\"");
            appsMenuButton.menu.close();
        });
        return button.actor;
    },
    _createSeparator: function()
    {
        let separator = new St.DrawingArea({ style_class: 'popup-separator-menu-item' });
        separator.connect('repaint', Lang.bind(this, this._onRepaintSeparator));
        return separator;
    },
    _onRepaintSeparator: function(area){
        let cr = area.get_context();
        let themeNode = area.get_theme_node();
        let [width, height] = area.get_surface_size();
        let margin = themeNode.get_length('-margin-horizontal');
        let gradientHeight = themeNode.get_length('-gradient-height');
        let startColor = themeNode.get_color('-gradient-start');
        let endColor = themeNode.get_color('-gradient-end');
        let gradientWidth = (width - margin * 2);
        let gradientOffset = (height - gradientHeight) / 2;
        let pattern = new Cairo.LinearGradient(margin, gradientOffset, width - margin, gradientOffset + gradientHeight);
        pattern.addColorStopRGBA(0, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255);
        pattern.addColorStopRGBA(0.5, endColor.red / 255, endColor.green / 255, endColor.blue / 255, endColor.alpha / 255);
        pattern.addColorStopRGBA(1, startColor.red / 255, startColor.green / 255, startColor.blue / 255, startColor.alpha / 255);
        cr.setSource(pattern);
        cr.rectangle(margin, gradientOffset, gradientWidth, gradientHeight);
        cr.fill();
    },
    _onMenuKeyPress: function(actor, event) {
        let symbol = event.get_key_symbol();
        if(symbol == Clutter.KEY_Super_R) {
            this.menu.close();
            return true;
        }
        if(symbol == Clutter.KEY_Tab) {
            this.favoritesSwith.emit('clicked',1);
            return true;
        }
        if (this._activeContainer === null && symbol == Clutter.KEY_Up) {
            this._activeContainer = this.applicationsBox;
            children = this._activeContainer.get_children();
            this._selectedItemIndex = children.length;
        } else if (this._activeContainer === null && symbol == Clutter.KEY_Down) {
            this._activeContainer = this.applicationsBox;
            children = this._activeContainer.get_children();
            this._selectedItemIndex = -1;
        }else if (this._activeContainer === null) {
            this._activeContainer = this.categoriesBox;
            this._selectedItemIndex = -1;
            this._previousSelectedItemIndex = -1;
        }else if (this._activeContainer == this.favoritesTable) {
            this._favSelectedItemIndex = this._favSelectedItemIndex===null?-1:this._favSelectedItemIndex;
            children = this._activeContainer.get_children();
        }
        let children = this._activeContainer.get_children();
        if (children.length==0){
            this._activeContainer = this.categoriesBox;
            this._selectedItemIndex = -1;
            this._previousSelectedItemIndex = -1;
            children = this._activeContainer.get_children();
        }
        if(this._activeContainer != this.favoritesTable) {
            let index = this._selectedItemIndex;
            if (symbol == Clutter.KEY_Up) {
                index = this._selectedItemIndex - 1 < 0 ? 0 : this._selectedItemIndex - 1;
            } else if (symbol == Clutter.KEY_Down) {
                index = this._selectedItemIndex + 1 == children.length ? children.length - 1 : this._selectedItemIndex + 1;
            } else if (symbol == Clutter.KEY_Right && this._activeContainer === this.categoriesBox) {
                this._activeContainer = this.applicationsBox;
                children = this._activeContainer.get_children();
                index = 0;
                this._previousSelectedItemIndex = this._selectedItemIndex;
                this._selectedItemIndex = -1;
            } else if (symbol == Clutter.KEY_Left && this._activeContainer === this.applicationsBox) {
                this._clearSelections(this.applicationsBox);
                this._activeContainer = this.categoriesBox;
                children = this._activeContainer.get_children();
                index = this._previousSelectedItemIndex;
                this._selectedItemIndex = -1;
            } else if (this._activeContainer === this.applicationsBox && (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return || symbol == Clutter.KP_Enter)) {
                let item_actor = children[this._selectedItemIndex];
                item_actor.emit('clicked', 1);
                return true;
            } else {
                return false;
            }
            if (index == this._selectedItemIndex) {
                return true;
            }
            if (index>=children.length) index = children.length-1;
            this._selectedItemIndex = index;

            let item_actor = children[this._selectedItemIndex];
            if (!item_actor || item_actor === this.searchEntry) {
                return false;
            }
            if(!item_actor._delegate) {
                if(symbol == Clutter.KEY_Down){
                    ++this._selectedItemIndex;
                    item_actor = children[this._selectedItemIndex];
                }else if(symbol == Clutter.KEY_Up){
                    --this._selectedItemIndex;
                    item_actor = children[this._selectedItemIndex];
                }
            }
            if(this._activeContainer === this.categoriesBox && this.cm.click_on_category)
                item_actor.emit('clicked', 1);
            else
                item_actor._delegate.emit('enter-event');
        }else{
            let index = this._favSelectedItemIndex;
            if (symbol == Clutter.KEY_Up || symbol == Clutter.KEY_Left) {
                index = this._favSelectedItemIndex - 1 < 0 ? 0 : this._favSelectedItemIndex - 1;
            } else if (symbol == Clutter.KEY_Down || symbol == Clutter.KEY_Right) {
                index = this._favSelectedItemIndex + 1 == children.length ? children.length - 1 : this._favSelectedItemIndex + 1;
            } else if (this._favSelectedItemIndex>=0 && (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return || symbol == Clutter.KP_Enter)) {
                let item_actor = children[this._favSelectedItemIndex];
                item_actor.emit('clicked', 1);
                return true;
            } else {
                return false;
            }
            if (index == this._favSelectedItemIndex) {
                return true;
            }
            if (index>=children.length) index = children.length-1;
            this._favSelectedItemIndex = index;
            let item_actor = children[this._favSelectedItemIndex];
            if (!item_actor || item_actor === this.searchEntry) {
                return false;
            }
            item_actor._delegate.emit('enter-event');
        }
        return true;
    },
    _addEnterEvent: function(button, callback) {
        let _callback = Lang.bind(this, function() {
            let parent = button.actor.get_parent();
            if (this._activeContainer === this.categoriesBox && parent !== this._activeContainer) {
                this._previousSelectedItemIndex = this._selectedItemIndex;
            }
            this._activeContainer = parent;
            let children = this._activeContainer.get_children();
            for (let i=0, l=children.length; i<l; i++) {
                if (button.actor === children[i]) {
                    this._selectedItemIndex = i;
                }
            };
            callback();
        });
        button.connect('enter-event', _callback);
        button.actor.connect('enter-event', _callback);
    },
    _addFavEnterEvent: function(button, callback) {
        let _callback = Lang.bind(this, function() {
            let children = this._activeContainer.get_children();
            for (let i=0, l=children.length; i<l; i++) {
                if (button.actor === children[i]) {
                    this._favSelectedItemIndex = i;
                }
            };
            callback();
        });
        button.connect('enter-event', _callback);
        button.actor.connect('enter-event', _callback);
    },
    _clearSelections: function(container) {
        container.get_children().forEach(function(actor) {
        if(actor.style_class != 'popup-separator-menu-item')
            actor.style_class = "category-button";
        });
    },
    _clearFavSelections: function() {
        this.favoritesTable.get_children().forEach(function(actor) {
            actor.remove_style_pseudo_class('hover');
        });
    },
    _onOpenStateToggled: function(menu, open) {
       if (open) {
           this.resetSearch();
           this._selectedItemIndex = null;
           this._favSelectedItemIndex = null;
           this._clearFavSelections();
           
           if(this.cm.start_with_fav){
               this.favoritesBox.show();
               this.categoriesApplicationsBox.hide();
               this.favoritesSwith.set_label(_("All applications"));
               this._activeContainer = this.favoritesTable;
           }else{
               this.favoritesBox.hide();
               this.categoriesApplicationsBox.show();
               this.favoritesSwith.set_label(_("Favorites"));
               this._activeContainer = null;
           }
           this.selectedAppTitle.set_text("");
           this.selectedAppDescription.set_text("");
       }
       AxeButton.prototype._onOpenStateChanged.call(menu, open);
    },
    reDisplay : function(e,object,p0,p1) {
        if(this.reloadFlag && (p1==3 || p1===undefined)){
            this._cleanControls();
            this._display();
        }
        this.reloadFlag = true;
    },
    _cleanControls: function(){
        cleanActor(this.favoritesTable);
        cleanActor(this.categoriesBox);
        cleanActor(this.applicationsBox);
        cleanActor(this.leftPane);
    },
    _loadCategory: function(dir) {
        var iter = dir.iter();
        var nextType;
        while ((nextType = iter.next()) != GMenu.TreeItemType.INVALID) {
            if (nextType == GMenu.TreeItemType.ENTRY) {
                var entry = iter.get_entry();
                if (!entry.get_app_info().get_nodisplay()) {
                    var app = appsys.lookup_app_by_tree_entry(entry);
                    if (!this.applicationsByCategory[dir.get_menu_id()]) this.applicationsByCategory[dir.get_menu_id()] = new Array();
                    this.applicationsByCategory[dir.get_menu_id()].push(app);
                }
            } else if (nextType == GMenu.TreeItemType.DIRECTORY) {
                let subdir = iter.get_directory();
                if (subdir.get_is_nodisplay()) continue;
                this.applicationsByCategory[subdir.get_menu_id()] = new Array();
                this._loadCategory(subdir);
                if (this.applicationsByCategory[subdir.get_menu_id()].length>0){
                   let categoryButton = new CategoryButton(this,subdir,this.cm.category_icon_size);
                   if (subdir.get_menu_id()==this.cm.stored_category_id) {
                        this._select_category(categoryButton.category, categoryButton);
                        categoryButton.actor.style_class = "category-button-selected";
                        this._scrollToCatButton(categoryButton);
                   }
                   this.categoriesBox.add_actor(categoryButton.actor);
                }
            }
        }
    },
    _scrollToButton: function(button) {
        var current_scroll_value = this.applicationsScrollBox.get_vscroll_bar().get_adjustment().get_value();
        var box_height = this.applicationsScrollBox.get_allocation_box().y2-this.applicationsScrollBox.get_allocation_box().y1;
        var new_scroll_value = current_scroll_value;
        if (current_scroll_value > button.actor.get_allocation_box().y1-10) new_scroll_value = button.actor.get_allocation_box().y1-10;
        if (box_height+current_scroll_value < button.actor.get_allocation_box().y2+10) new_scroll_value = button.actor.get_allocation_box().y2-box_height+10;
        if (new_scroll_value!=current_scroll_value) this.applicationsScrollBox.get_vscroll_bar().get_adjustment().set_value(new_scroll_value);
    },
    _scrollToCatButton: function(button) {
        var current_scroll_value = this.categoriesScrollBox.get_vscroll_bar().get_adjustment().get_value();
        var box_height = this.categoriesScrollBox.get_allocation_box().y2-this.categoriesScrollBox.get_allocation_box().y1;
        var new_scroll_value = current_scroll_value;
        if (current_scroll_value > button.actor.get_allocation_box().y1-10) new_scroll_value = button.actor.get_allocation_box().y1-10;
        if (box_height+current_scroll_value < button.actor.get_allocation_box().y2+10) new_scroll_value = button.actor.get_allocation_box().y2-box_height+10;
        if (new_scroll_value!=current_scroll_value) this.categoriesScrollBox.get_vscroll_bar().get_adjustment().set_value(new_scroll_value);
    },
    _createLayout: function() {
        let section = new PopupMenu.PopupMenuSection();
        this.menu.addMenuItem(section);
        this.favoritesBox = new St.BoxLayout({ style_class: 'applications-menu-favorites-box', vertical: true });
        this.favoritesTable = new St.Table({ homogeneous: true, reactive: true, style_class: 'applications-menu-favorites-table' });
        this.rightPane = new St.BoxLayout({ style_class: 'rightpane-box', vertical: true });
        this.leftPane = new St.BoxLayout({ style_class: 'leftpane-box', vertical: true });
        this.searchBox = new St.BoxLayout({ style_class: 'search_box' });
        this.rightPane.add_actor(this.searchBox);
        this.searchEntry = new St.Entry({ name: 'searchEntry', hint_text: _("Type to search..."), track_hover: true, can_focus: true });
        this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
        this.searchBox.add_actor(this.searchEntry);
        this.searchEntryText = this.searchEntry.clutter_text;
        this.searchEntryText.connect('text-changed', Lang.bind(this, this._onSearchTextChanged));
        this.searchEntryText.connect('key-press-event', Lang.bind(this, this._onMenuKeyPress));
        this._buttonLayout = new St.BoxLayout({ style_class: 'favorites-button-box', vertical: false });
        this.favoritesSwith = new St.Button({ style_class: 'modal-dialog-button favswich-button', reactive: true, can_focus: false,
                                                label: _("All applications") });
        this._buttonLayout.add(this.favoritesSwith, { expand: true, x_fill: false, y_fill: false, x_align: St.Align.END, y_align: St.Align.MIDDLE });
        this.searchBox.add(this._buttonLayout, { expand:  true, x_align: St.Align.END, y_align: St.Align.MIDDLE });
        this.favoritesSwith.connect('clicked', Lang.bind(this, function() {
            if (this.favoritesBox.visible){
                this.favoritesBox.hide();
                this._activeContainer = null;
                this.categoriesApplicationsBox.show();
                this.favoritesSwith.set_label(_("Favorites"));
                
            }else{
                this.favoritesBox.show();
                this.selectedAppTitle.set_text("");
                this.selectedAppDescription.set_text("");
                this._activeContainer = this.favoritesTable;
                this.categoriesApplicationsBox.hide();
                this.favoritesSwith.set_label(_("All applications"));
            }
            this.selectedAppTitle.set_text("");
            this.selectedAppDescription.set_text("");
        }));
        this.categoriesApplicationsBox = new St.BoxLayout({ style_class: 'categories-app-box'});
        this.rightPane.add(this.categoriesApplicationsBox, { expand: true,x_fill: true,y_fill: true });
        this.categoriesBox = new St.BoxLayout({ style_class: 'categories-box', vertical: true });
        this.applicationsScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'vfade applications-scrollbox' });
        let vscroll = this.applicationsScrollBox.get_vscroll_bar();
        vscroll.connect('scroll-start', Lang.bind(this, function() {
                              this.menu.passEvents = true;
                          }));
        vscroll.connect('scroll-stop', Lang.bind(this, function() {
                              this.menu.passEvents = false;
                          }));
        this.categoriesScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'vfade categories-scrollbox' });
        vscroll = this.categoriesScrollBox.get_vscroll_bar();
        vscroll.connect('scroll-start', Lang.bind(this, function() {
                              this.menu.passEvents = true;
                          }));
        vscroll.connect('scroll-stop', Lang.bind(this, function() {
                              this.menu.passEvents = false;
                          }));
        this.applicationsBox = new St.BoxLayout({ style_class: 'applications-box', vertical:true });
        this.applicationsScrollBox.add_actor(this.applicationsBox);
        this.categoriesScrollBox.add_actor(this.categoriesBox, { expand: true,x_fill: false });
        this.applicationsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.categoriesApplicationsBox.add(this.categoriesScrollBox, { expand: false,x_fill: true,y_fill: false, y_align: St.Align.START });
        this.categoriesApplicationsBox.add(this.applicationsScrollBox, { expand: true,x_fill: true,y_fill: true });
        this.mainBox = new St.BoxLayout({ style_class: 'main-box', vertical:false });
        this.favoritesBox.add_actor(this.favoritesTable);
        this.rightPane.add_actor(this.favoritesBox, { expand: true,x_fill: false,y_fill: false });
        this.mainBox.add(this.leftPane, { expand: false,x_fill: false,y_fill: false, y_align: St.Align.START });
        this.mainBox.add(this.rightPane, { expand: true,x_fill: true,y_fill: true });
        section.actor.add_actor(this.mainBox);
        this.selectedAppBox = new St.BoxLayout({ style_class: 'selected-app-box', vertical: true });
        this.selectedAppTitle = new St.Label({ style_class: 'selected-app-title', text: "" });
        this.selectedAppBox.add_actor(this.selectedAppTitle);
        this.selectedAppDescription = new St.Label({ style_class: 'selected-app-description', text: "" });
        this.selectedAppBox.add_actor(this.selectedAppDescription);
        this.settingsAndselectedAppBox = new St.BoxLayout();
        this.settingsAndselectedAppBox.add(this._createSettingsButton(), { expand: false,x_fill: false,y_fill: false, y_align: St.Align.END });
        this.settingsAndselectedAppBox.add(this.selectedAppBox, { expand: true,x_fill: true,y_fill: true });
        section.actor.add_actor(this.settingsAndselectedAppBox);
    },
    _display : function() {
        this.cm.loadConfig();
        this._activeContainer = null;
        this._applicationsButtons = new Array();
        this.leftPane.style=('width: '+this.cm.left_pane_width+'px;');
        this.categoriesScrollBox.style=('width: '+this.cm.categories_box_width+'px;');
        this.mainBox.style=('width: '+this.cm.main_box_width+'px;');
        this.searchActive = false;
        this.searchEntry.width = this.cm.searchentry_width;
        if(this.cm.show_left_pane)
            this.leftPane.show();
        else
            this.leftPane.hide();
        if(this.cm.show_bottom_pane)
            this.settingsAndselectedAppBox.show();
        else
            this.settingsAndselectedAppBox.hide();
        this._previousSearchPattern = "";
        this.categoriesApplicationsBox.hide();

        //Load favorites
        let launchers = global.settings.get_strv('favorite-apps');
        let appSys = Shell.AppSystem.get_default();
        let j = 0;
        let column=0;
        let rownum=0;
        for ( let i = 0; i < launchers.length; ++i ) {
        let app = appSys.lookup_app(launchers[i]);
            if (app) {
                let button = new FavoritesButton(app,this.cm.favorites_icon_size,this.cm.favorites_text);
                this.favoritesTable.add(button.actor, { row: rownum, col: column });
                this._addFavEnterEvent(button, Lang.bind(this, function() {
                   this.selectedAppTitle.set_text(button._app.get_name());
                   if (button._app.get_description()) this.selectedAppDescription.set_text(button._app.get_description());
                   else this.selectedAppDescription.set_text("");
                   this._clearFavSelections();
                   button.actor.add_style_pseudo_class('hover');
                }));
                button.actor.connect('leave-event', Lang.bind(this, function() {
                   this.selectedAppTitle.set_text("");
                   this.selectedAppDescription.set_text("");
                }));
                ++j;
                ++column;
                if(column==this.cm.favorites_columns){
                    column=0;
                    ++rownum;
                }
            }
        }
        //Load left
        if(this.cm.display_places){
            this.leftPane.add(new St.Label({ style_class: 'pane-title',opacity: 180, text: _("Places") }));
            this.leftPane.add_actor(this._createComputer());
            this.leftPane.add_actor(this._createHome());
            this.leftPane.add_actor(this._createDesktop());
            this.leftPane.add_actor(this._createNetwork());
        }
        if(this.cm.display_bookmarks){
            let bookmarks = this._listBookmarks();
            this.leftPane.add(new St.Label({ style_class: 'pane-title',opacity: 180, text: _("Bookmarks") }));
            for (var i=0; i<bookmarks.length; i++) {
               let place = bookmarks[i];
               let button = new PlaceButton(place, place.name,this.cm.leftpane_icon_size);
               this.leftPane.add_actor(button.actor);
            }
        }
        if(this.cm.display_system){
            let sysTitle = new St.Label({ style_class: 'pane-title',opacity: 180, text: _("System") });
            this.leftPane.add(sysTitle);
            for (var i=0; i<this.cm.system_apps.length; i++) {
               let app = appsys.lookup_app(this.cm.system_apps[i]+'.desktop');
               if(app){
                   let button = new ApplicationButton(app,this.cm.leftpane_icon_size);
                   this.leftPane.add_actor(button.actor);
               }
            }
            if(this.cm.display_search)
                this.leftPane.add_actor(this._createSearch());
        }
        if(this.cm.display_shutdown){
            this.leftPane.add(this._createSeparator(), { span: -1 });
            let reexecButton = new BaseButton(_("Restart Shell"),"view-refresh",20,St.IconType.SYMBOLIC,function() {
                appsMenuButton.menu.close();
                appsMenuButton.reloadFlag = false;
                appsMenuButton.cm.saveConfig();
                global.reexec_self();
            });
            this.leftPane.add_actor(reexecButton.actor);

            let logoutButton = new BaseButton(_("Logout"),"edit-clear",20,St.IconType.SYMBOLIC,function() {
                _session.LogoutRemote(0);
                appsMenuButton.menu.close();
            });
            this.leftPane.add_actor(logoutButton.actor);

            let exitButton = new BaseButton(_("Power Off"),"system-shutdown",20,St.IconType.SYMBOLIC,function() {
                _session.ShutdownRemote();
                appsMenuButton.menu.close();
            });
            this.leftPane.add_actor(exitButton.actor);
        }
        //Load categories
        this.applicationsByCategory = {};
        let tree = appsys.get_tree();
        let root = tree.get_root_directory();
        let categoryButton = new CategoryButton(this,null,this.cm.category_icon_size);
        categoryButton.actor.style_class = "category-button-selected";
        categoryButton.actor._delegate.emit('enter-event');
        this.categoriesBox.add_actor(categoryButton.actor);
        this.categoriesBox.add(this._createSeparator());
        let iter = root.iter();
        let nextType;
        while ((nextType = iter.next()) != GMenu.TreeItemType.INVALID) {
            if (nextType == GMenu.TreeItemType.DIRECTORY) {
                let dir = iter.get_directory();
                if (dir.get_is_nodisplay()) continue;
                this.applicationsByCategory[dir.get_menu_id()] = new Array();
                this._loadCategory(dir);
                if (this.applicationsByCategory[dir.get_menu_id()].length>0){
                   let categoryButton = new CategoryButton(this,dir,this.cm.category_icon_size);
                   if (dir.get_menu_id()==this.cm.stored_category_id) {
                        this._select_category(categoryButton.category, categoryButton);
                        categoryButton.actor.style_class = "category-button-selected";
                        this._scrollToCatButton(categoryButton);
                   }
                   this.categoriesBox.add_actor(categoryButton.actor);
                }
            }
        }
        //Load applications
        this._displayButtons(this._listApplications(this.cm.stored_category_id));

        let smartHeight;
        if(this.cm.smart_height){
            let catHeight = this.categoriesBox.height+45;
            if(this.cm.category_with_scroll)
                catHeight = 0;
            let leftHeight = this.leftPane.height;
            if(!this.cm.show_left_pane)
                leftHeight = 0;
            smartHeight = Math.max(this.favoritesBox.height+20,catHeight,leftHeight)+20+'px;';
        }else{
            smartHeight = 'auto;';
        }
        this.mainBox.style+=('height: '+smartHeight);
    },
    _clearApplicationsBox: function(selectedActor){
        let actors = this.applicationsBox.get_children();
        for (var i=0; i<actors.length; i++) {
            let actor = actors[i];
            this.applicationsBox.remove_actor(actor);
        }
        let actors = this.categoriesBox.get_children();
        for (var i=0; i<actors.length; i++){
            let actor = actors[i];
            if(actor.style_class != "popup-separator-menu-item")
                if (actor==selectedActor) actor.style_class = "category-button-selected";
                else actor.style_class = "category-button";
        }
    },
     _select_category : function(dir, categoryButton) {
       this.resetSearch();
       this._clearApplicationsBox(categoryButton.actor);
       if (dir) this._displayButtons(this._listApplications(dir.get_menu_id()));
       else this._displayButtons(this._listApplications(null));
    },
    _displayButtons: function(apps){
         if (apps){
            for (var i=0; i<apps.length; i++) {
               let app = apps[i];
               if (!this._applicationsButtons[app]){
                  let applicationButton = new ApplicationButton(app,this.cm.application_icon_size);
                  applicationButton.actor.connect('leave-event', Lang.bind(this, function() {
                     this.selectedAppTitle.set_text("");
                     this.selectedAppDescription.set_text("");
                  }));
                  this._addEnterEvent(applicationButton, Lang.bind(this, function() {
                      this.selectedAppTitle.set_text(applicationButton.app.get_name());
                      if (applicationButton.app.get_description()) this.selectedAppDescription.set_text(applicationButton.app.get_description());
                      else this.selectedAppDescription.set_text("");
                      this._clearSelections(this.applicationsBox);
                      applicationButton.actor.style_class = "category-button-selected";
                      this._scrollToButton(applicationButton);
                  }));
                  this._applicationsButtons[app] = applicationButton;
               }
               this.applicationsBox.add_actor(this._applicationsButtons[app].actor);
            }
         }
    },
     resetSearch: function(){
        this.searchEntry.set_text("");
        this.searchActive = false;
        global.stage.set_key_focus(this.searchEntry);
     },
     _onSearchTextChanged: function (se, prop) {
        this.searchActive = this.searchEntry.get_text() != '';
        if (this.searchActive) {
            this._clearSelections(this.categoriesBox);
            this._clearSelections(this.applicationsBox);
            this.favoritesBox.hide();
            this._activeContainer = null;
            this.categoriesApplicationsBox.show();
            this.favoritesSwith.set_label(_("Favorites"));
            this.searchEntry.set_secondary_icon(this._searchActiveIcon);
            if (this._searchIconClickedId == 0) {
                this._searchIconClickedId = this.searchEntry.connect('secondary-icon-clicked',
                    Lang.bind(this, function() {
                        this.resetSearch();
                    }));
            }
        } else {
            if (this._searchIconClickedId > 0)
                this.searchEntry.disconnect(this._searchIconClickedId);
            this._searchIconClickedId = 0;
            this.searchEntry.set_secondary_icon(this._searchInactiveIcon);
        }
        if (!this.searchActive) {
            if (this._searchTimeoutId > 0) {
                Mainloop.source_remove(this._searchTimeoutId);
                this._searchTimeoutId = 0;
            }
            return;
        }
        if (this._searchTimeoutId > 0)
            return;
        this._searchTimeoutId = Mainloop.timeout_add(150, Lang.bind(this, this._doSearch));
    },
    _listBookmarks: function(pattern){
       let bookmarks = this.placesManager.getBookmarks();
       var res = new Array();
       let bookmarksLength = ((this.cm.max_bookmarks) && this.cm.max_bookmarks < bookmarks.length)?this.cm.max_bookmarks:bookmarks.length;
       for (let id = 0; id < bookmarksLength; id++) {
          if (!pattern || bookmarks[id].name.toLowerCase().indexOf(pattern)!=-1) res.push(bookmarks[id]);
       }
       return res;
    },
    _listDevices: function(pattern){
       let devices = this.placesManager.getMounts();
       var res = new Array();
       for (let id = 0; id < devices.length; id++) {
          if (!pattern || devices[id].name.toLowerCase().indexOf(pattern)!=-1) res.push(devices[id]);
       }
       return res;
    },
    _listApplications: function(category_menu_id, pattern){
       var applist;
       if (category_menu_id) applist = this.applicationsByCategory[category_menu_id];
       else{
          applist = new Array();
          for (directory in this.applicationsByCategory){
              applist = applist.concat(this.applicationsByCategory[directory]);
          }
       }
       var res;
       if (pattern){
          res = new Array();
          for (var i in applist){
             let app = applist[i];
             if (app.get_name().toLowerCase().indexOf(pattern)!=-1 || (app.get_description() && app.get_description().toLowerCase().indexOf(pattern)!=-1)) res.push(app);
          }
       }else res = applist;
       res.sort(function(a,b){
          return a.get_name().toLowerCase() > b.get_name().toLowerCase();
       });
       return res;
    },
    _doSearch: function(){
       this._searchTimeoutId = 0;
       let pattern = this.searchEntryText.get_text().replace(/^\s+/g, '').replace(/\s+$/g, '').toLowerCase();
       if (pattern==this._previousSearchPattern) return false;
       this._previousSearchPattern = pattern;
       this._activeContainer = null;
       this._selectedItemIndex = null;
       this._previousSelectedItemIndex = null;
       if (pattern.length == 0) {
           return false;
       }
       var appResults = this._listApplications(null, pattern);
       this._clearApplicationsBox();
       this._displayButtons(appResults);
       let actors = this.applicationsBox.get_children();
       if(actors[0])
            actors[0]._delegate.emit('enter-event');
       return false;
    }
};

let appsMenuButton;
let activitiesButton;
let activitiesButtonLabel;
let _installedChangedId;
let _favoritesChangedId;
let _bookmarksChangedId;
let extensionMeta,egoVersion;

function enable() {
    activitiesButton = Main.panel._activitiesButton;
    activitiesButtonLabel = Main.panel._activitiesButton._label.get_text();
    activitiesButton._hotCorner.actor.hide();
    appsMenuButton = new ApplicationsButton();
    insert_actor_to_box(Main.panel._leftBox,appsMenuButton.actor, 0);
    Main.panel._axeMenu = appsMenuButton;
    Main.panel._leftBox.remove_actor(activitiesButton.actor);
    if(appsMenuButton.cm.display_activites){
        let actpos = appsMenuButton.cm.activites_position?Main.panel._rightBox.get_children().length:0;
        insert_actor_to_box(Main.panel._rightBox,activitiesButton.actor, actpos);
    }
    activitiesButton._label.set_text("\u2318");
}

function disable() {
    Main.panel._leftBox.remove_actor(appsMenuButton.actor);
    Main.panel._menus.removeMenu(appsMenuButton.menu);
    activitiesButton._hotCorner.actor.show();
    if(appsMenuButton.cm.display_activites) Main.panel._rightBox.remove_actor(activitiesButton.actor);
    insert_actor_to_box(Main.panel._leftBox,activitiesButton.actor, 0);
    activitiesButton._label.set_text(activitiesButtonLabel);
    appsys.disconnect(_installedChangedId);
    AppFavorites.getAppFavorites().disconnect(_favoritesChangedId);
    appsMenuButton.placesManager.disconnect(_bookmarksChangedId);
    appsMenuButton.destroy();
}

function init(metadata) {
    let localePath = metadata.path + '/locale';
    extensionMeta = metadata;
    egoVersion = ShellVersion[1]<4?metadata.version:metadata.metadata['version'];
    Gettext.bindtextdomain('axemenu', localePath);
}
