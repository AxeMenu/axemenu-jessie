


const Lang = imports.lang;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const ModalDialog = imports.ui.modalDialog;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Signals = imports.signals;
const Pango = imports.gi.Pango;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
let ConfirmDialog = Extension.imports.common.ConfirmDialog;
let BaseButton = Extension.imports.common.BaseButton;
let ApplicationButton = Extension.imports.common.ApplicationButton;
let ToggleSwitch = Extension.imports.common.ToggleSwitch;
const Version = Extension.imports.common.Version;
const cleanActor = Extension.imports.common.cleanActor;
const insert_actor_to_box = Extension.imports.common.insert_actor_to_box;

function ConfigManager(parent) {
    this._init(parent);
}
ConfigManager.prototype = {
    _init: function (parent) {
        this.config_file = this._initConfigFile();
        this._conf = {};
        this.parent = parent;
    },
    get_val: function (key, defaultValue) {
        return (this._conf[key] == undefined) ? defaultValue : this._conf[key];
    },
    get_enum: function (key, defaultValue) {
        let res;
        try {
            res = this._conf[key].split(',');
        } catch (e) {
            res = defaultValue;
        }
        return res;
    },
    set_val: function (key, value) {
        this._conf[key] = value;
    },
    _initConfigFile: function () {
        let filename;
        if (!GLib.file_test(GLib.get_home_dir() + '/.config', GLib.FileTest.EXISTS)) {
            filename = GLib.get_home_dir() + '/.axemenu.conf';
        } else {
            filename = GLib.get_home_dir() + '/.config/axemenu.conf';
        }
        if (!GLib.file_test(filename, GLib.FileTest.EXISTS)) {
            this._createDefaultConfig(filename);
        }
        return filename;
    },
    _createDefaultConfig: function (filename) {
        let default_content = "{}";
        GLib.file_set_contents(filename, default_content, default_content.length);
    },
    implode: function (glue, pieces) {
        return ( ( pieces instanceof Array ) ? pieces.join(glue) : pieces );
    },
    loadConfig: function () {
        let data = GLib.file_get_contents(this.config_file)[1].toString();
        this._conf = JSON.parse(data);
        this.display_activites = this.get_val('display_activites', true);
        this.activites_position = this.get_val('activites_position', false);
        this.defaultBookmarksCount = 5;
        this.defaultFavColumns = global.settings.get_strv('favorite-apps').length > 12 ? 3 : 2;
        Main.panel._rightBox.remove_actor(this.parent.getActivitiesButton().actor);
        if (this.display_activites) {
            let actpos = this.activites_position ? Main.panel._rightBox.get_children().length : 0;
            insert_actor_to_box(Main.panel._rightBox, this.parent.getActivitiesButton().actor, actpos);
        } else {
            Main.panel._rightBox.remove_actor(this.parent.getActivitiesButton().actor);
        }
        this.button_label = decodeURIComponent(this.get_val('button_label', _("Menu")));
        this.display_icon = this.get_val('display_icon', true);
        this.is_hot_corner = this.get_val('is_hot_corner', true);

        if (!this.is_hot_corner) {
            this.parent._hotCorner.actor.hide();
        } else {
            this.parent._hotCorner.actor.show();
        }

        this.icon_name = this.get_val('icon_name', 'start-here');
        this.parent._icon.set_icon_name(this.icon_name);
        this.start_with_fav = this.get_val('start_with_fav', true);
        if (!this.display_icon)
            this.parent._iconBox.hide();
        else
            this.parent._iconBox.show();
        if (this.button_label != '') {
            this.parent._label.set_text(this.button_label);
            this.parent._label.show();
        } else {
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
        this.system_apps = this.get_enum('system_apps', ['gnome-control-center', 'gnome-terminal']);
        this.display_shutdown = this.get_val('display_shutdown', true);
        this.show_left_pane = this.get_val('show_left_pane', true);
        this.show_bottom_pane = this.get_val('show_bottom_pane', true);
        this.max_bookmarks = this.get_val('max_bookmarks', this.defaultBookmarksCount);
        this.searchentry_width = this.get_val('searchentry_width', 240);
        this.favorites_text = this.get_val('favorites_text', true);
        this.favorites_columns = this.get_val('favorites_columns', this.defaultFavColumns);
        this.favorites_icon_size = this.get_val('favorites_icon_size', 68);
        this.category_with_scroll = this.get_val('category_with_scroll', false);
        this.category_icon_size = this.get_val('category_icon_size', 24);
        this.leftpane_icon_size = this.get_val('leftpane_icon_size', 22);
        this.application_icon_size = this.get_val('application_icon_size', 32);
        this.categories_box_width = this.get_val('categories_box_width', 180);
        this.smart_height = this.get_val('smart_height', true);
        this.axe_in_hotcorner = this.get_val('axe_in_hotcorner', false);
        this.click_on_category = this.get_val('click_on_category', false);
        this.search_tool = decodeURIComponent(this.get_val('search_tool', "gnome-search-tool"));
        this.stored_category_id = this.get_val('category_menu_id', null);
        //this.symbolic_icons = this.get_val('symbolic_icons', false);
    },
    saveConfig: function () {
        GLib.file_set_contents(this.config_file, JSON.stringify(this._conf), -1);
    },
    resetToDefault: function () {
        GLib.file_set_contents(this.config_file, '{}', -1);
        this.parent.reDisplay();
    },
    destroy: function () {

    },
    getLayoutManager: function (){
        return this.parent._layoutManager;
    }
};

function NB() {
    this._init();
}
NB.prototype = {
    _init: function () {
        this.actor = new St.BoxLayout({styleClass: 'config-notebook-box'});
        this.actor._delegate = this;
        this.tabsControls = new St.BoxLayout({vertical: true, styleClass: 'config-notebook-tabs' });
        this.actor.add(this.tabsControls);
        this.pagesControls = new St.BoxLayout();
        this.actor.add(this.pagesControls, { expand: true, x_fill: true, y_fill: false, y_align: St.Align.START });
        this._tabs = new Array();
    },
    addTab: function (title) {
        let tab = new BaseButton(title, null, 0, 0, function () {
            this.tabsControls.get_children().forEach(function (c) {
                c.style_class = "application-button"
            });
            this.actor.style_class = "application-button-selected";
            this.pagesControls.get_children().forEach(function (c) {
                c.hide()
            });
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
    showTab: function (index) {
        this._tabs[index].actor.emit('clicked', 1);
    },
    clean: function () {
        this._tabs = new Array();
        cleanActor(this.tabsControls);
        this.pagesControls.get_children().forEach(function (c) {
            cleanActor(c)
        });
        cleanActor(this.pagesControls);
    }
};
Signals.addSignalMethods(NB.prototype);

function MicroHighlighter(parent, text, lineWrap, allowMarkup) {
    this._init(parent, text, lineWrap, allowMarkup);
}
//from ui/messageTray.js
MicroHighlighter.prototype = {
    _init: function (parent, text, lineWrap, allowMarkup) {
        if (!text)
            text = '';
        this._urlRegexp = new RegExp('(\\[url=(.+)\\](.+)\\[/url\\])', 'gi');
        this._parent = parent;
        this.actor = new St.BoxLayout();
        this.label = new St.Label({ reactive: true });
        this.actor.add(this.label);
        this._linkColor = '#ccccff';
        this.label.connect('style-changed', Lang.bind(this, function () {
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
        this.label.connect('button-press-event', Lang.bind(this, function (actor, event) {
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
        this.label.connect('motion-event', Lang.bind(this, function (actor, event) {
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
        this.label.connect('leave-event', Lang.bind(this, function () {
            if (!this.label.visible || this.label.get_paint_opacity() == 0)
                return;
            if (this._cursorChanged) {
                this._cursorChanged = false;
                global.unset_cursor();
            }
        }));
    },
    _fixMarkup: function (text, allowMarkup) {
        if (allowMarkup) {
            let _text = text.replace(/&(?!amp;|quot;|apos;|lt;|gt;)/g, '&amp;');
            _text = _text.replace(/<(?!\/?[biu]>)/g, '&lt;');
            try {
                Pango.parse_markup(_text, -1, '');
                return _text;
            } catch (e) {
            }
        }
        return GLib.markup_escape_text(text, -1);
    },
    setMarkup: function (text, allowMarkup) {
        text = text ? this._fixMarkup(text, allowMarkup) : '';
        this._text = text;
        this.label.clutter_text.set_markup(text);
        /* clutter_text.text contain text without markup */
        this._urls = this.findUrls(this.label.clutter_text.text);
        this._highlightUrls();
    },
    findUrls: function (str) {
        let res = [], match;
        while ((match = this._urlRegexp.exec(str)))
            res.push({ url: match[2], pos: match.index, text: match[3], urllength: match[0].length });
        return res;
    },
    _highlightUrls: function () {
        // text here contain markup
        let urls = this.findUrls(this._text);
        let markup = '';
        let pos = 0;
        let delta = 0;
        for (let i = 0; i < urls.length; i++) {
            let url = urls[i];
            let str = this._text.substr(pos, url.pos - pos);
            markup += str + '<span foreground="' + this._linkColor + '" size="x-small"><u>' + url.text + '</u></span>';
            pos = url.pos + url.urllength;
            this._urls[i].pos -= delta;
            delta += this._urls[i].urllength - this._urls[i].text.length;
        }
        markup += this._text.substr(pos);
        this.label.clutter_text.set_markup(markup);
    },
    _findUrlAtPos: function (event) {
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


/**
 *
 * @param {ConfigManager} parent
 * @constructor
 */
function ConfigDialog(ConfigManager) {
    this._init(ConfigManager);
}
ConfigDialog.prototype = {
    __proto__: ModalDialog.ModalDialog.prototype,
    _init: function (ConfigManager) {
        ModalDialog.ModalDialog.prototype._init.call(this, { styleClass: 'config-menu-dialog' });
        this.dialogLayout.style = ("padding: 18px 25px 35px 25px;");
        this.buttonLayout.style = ("padding-top: 0px;");
        this.cm = ConfigManager;
        this.notebook = new NB();
        let monitor = this.cm.getLayoutManager().primaryMonitor;
        let buttons = [
            { action: Lang.bind(this, this.save_settings), label: _("Save") },
            { action: Lang.bind(this, this.apply_settings), label: _("Apply") },
            { action: Lang.bind(this, this.close), label: _("Cancel") }
        ];
        this.setButtons(buttons);
        this._buttonKeys[Clutter.KEY_Escape] = Lang.bind(this, this.close);
        this.header = new St.Label({ style_class: 'config-dialog-header nb', text: _("AxeMenu settings") });
        this.contentLayout.add(this.header, { expand: true, x_fill: true, y_fill: false, x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE });
        this.contentLayout.add(this.notebook.actor, { expand: true, x_fill: true, y_fill: false });

    },
    _addSwith: function (parent, text, value) {
        let label = new St.Label({ style_class: 'config-dialog-label', text: _(text) });
        let box = new St.BoxLayout({vertical: false});
        box.add(label, { expand: true, x_fill: false, y_fill: false, x_align: St.Align.START, y_align: St.Align.MIDDLE });
        let switchcontrol = new ToggleSwitch(value);
        box.add_actor(switchcontrol.actor, { expand: true, x_fill: false, y_fill: false, x_align: St.Align.END, y_align: St.Align.MIDDLE });
        parent.add(box, {expand: true});
        return switchcontrol;
    },
    _addEntry: function (parent, text, value, classname, vertical, textual) {
        let label = new St.Label({ style_class: 'config-dialog-label', text: _(text) });
        vertical = vertical ? vertical : false;
        let box = new St.BoxLayout({ vertical: vertical});
        box.add(label, { expand: true, x_fill: false, y_fill: false, x_align: St.Align.START, y_align: St.Align.MIDDLE });
        classname = classname ? "config-dialog-entry " + classname : "config-dialog-entry";
        let entrycontrol = new St.Entry({style_class: classname, text: value.toString()});
        if (!textual) {
            entrycontrol.connect('scroll-event',
                Lang.bind(this, this._onScroll));
        }

        box.add(entrycontrol, { expand: true, x_fill: vertical, y_fill: false, x_align: St.Align.END, y_align: St.Align.MIDDLE });
        parent.add(box);
        return entrycontrol;
    },
    _addButton: function (parent, text, buttontext, callback) {
        let label = new St.Label({ style_class: 'config-dialog-label', text: _(text) });
        let box = new St.BoxLayout({vertical: false, style: "padding-top: 50px;"});
        box.add(label, { expand: true, x_fill: false, y_fill: false, x_align: St.Align.START, y_align: St.Align.MIDDLE });
        let button = new BaseButton(_(buttontext), null, 0, 0, callback);
        button.actor.add_style_class_name('button-reset');
        box.add(button.actor, { expand: true, x_fill: false, y_fill: false, x_align: St.Align.END, y_align: St.Align.MIDDLE });
        parent.add(box);
        return button;
    },
    _initControls: function (activetab) {
        let tab = this.notebook.addTab(_('Main'));
        this.ButtonLabel = this._addEntry(tab, 'Button label', this.cm.button_label, 'config-button-label-entry', false, true);
        this.displayIconSwitch = this._addSwith(tab, '"Menu" button with icon', this.cm.display_icon);
        this.MainIconEntry = this._addEntry(tab, 'Main icons size (px)', this.cm.main_icon_size);
        this.hotCornerSwitch = this._addSwith(tab, 'Hot corner', this.cm.is_hot_corner);
        this.axeCornerSwitch = this._addSwith(tab, 'AxeMenu in Hot corner', this.cm.axe_in_hotcorner);
        this.IconNameEntry = this._addEntry(tab, 'Icon name', this.cm.icon_name, 'config-button-label-entry', false, true);
        this.displayActivitesSwitch = this._addSwith(tab, 'Display Activites button', this.cm.display_activites);
        this.activitesPositionSwitch = this._addSwith(tab, 'Activites button rightmost', this.cm.activites_position);
        this.mainBoxWidthEntry = this._addEntry(tab, 'Main menu width (px)', this.cm.main_box_width);
        this.smartHeightSwitch = this._addSwith(tab, 'Fixed height of menu', this.cm.smart_height);
        this.startWithFavSwitch = this._addSwith(tab, 'Start with favorites', this.cm.start_with_fav);

        tab = this.notebook.addTab(_('Left pane'));
        this.showLeftSwitch = this._addSwith(tab, 'Display Left pane', this.cm.show_left_pane);
        this.LeftBoxWidthEntry = this._addEntry(tab, 'Left pane width (px)', this.cm.left_pane_width);
        this.MaxBookmarksEntry = this._addEntry(tab, 'Max bookmarks count (zero for show all)', this.cm.max_bookmarks);
        this.LeftIconEntry = this._addEntry(tab, 'Left pane icons size (px)', this.cm.leftpane_icon_size);
        this.displayPlacesSwitch = this._addSwith(tab, 'Display Places section', this.cm.display_places);
        this.displayBookmarksSwitch = this._addSwith(tab, 'Display Bookmarks section', this.cm.display_bookmarks);
        this.displaySystemSwitch = this._addSwith(tab, 'Display System section', this.cm.display_system);
        this.displaySearchSwitch = this._addSwith(tab, 'Display Search button', this.cm.display_search);
        this.displayShutdownSwitch = this._addSwith(tab, 'Display Shutdown section', this.cm.display_shutdown);
        this.SearchToolEntry = this._addEntry(tab, 'Search tool', this.cm.search_tool, 'config-button-label-entry', false, true);

        tab = this.notebook.addTab(_('Right pane'));
        this.SearchWidthEntry = this._addEntry(tab, 'Width of search entry (px)', this.cm.searchentry_width);
        this.FavTextSwitch = this._addSwith(tab, 'Favorites has label', this.cm.favorites_text);
        this.FavColEntry = this._addEntry(tab, 'Favorites columns count', this.cm.favorites_columns);
        this.FavIconEntry = this._addEntry(tab, 'Favorites icons size (px)', this.cm.favorites_icon_size);
        //this.symbolicIconsSwitch = this._addSwith(tab, 'Symbolic icons', this.cm.symbolic_icons);
        this.clickOnCategorySwitch = this._addSwith(tab, 'Select Category by click', this.cm.click_on_category);
        this.catWithScrollSwitch = this._addSwith(tab, 'Categories box has scroll', this.cm.category_with_scroll);
        this.CatIconEntry = this._addEntry(tab, 'Category icons size (px)', this.cm.category_icon_size);
        this.AppIconEntry = this._addEntry(tab, 'Applications icons size (px)', this.cm.application_icon_size);
        this.CatBoxWidthEntry = this._addEntry(tab, 'Categories box width (px)', this.cm.categories_box_width);

        tab = this.notebook.addTab(_('Additionally'));
        this.showBottomSwitch = this._addSwith(tab, 'Display bottom pane', this.cm.show_bottom_pane);
        this.SysAppsEntry = this._addEntry(tab, 'System Applications (Left pane)', this.cm.system_apps, "sysapps", true);
        this._addButton(tab, 'Reset to default', 'Reset', function () {
            appsMenuButton._configDialog.resetToDefault();
        });
        tab = this.notebook.addTab(_('About'));
        let about = 'error';
        try {
            about = GLib.file_get_contents(extensionMeta.path + "/ABOUT")[1].toString();
            about = about.replace('@version@', Version).replace('@e.g.o-version@', egoVersion);
        } catch (e) {
        }

        let aboutText = new MicroHighlighter(this, about, false, true);
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
        pint = pint < 0 ? 0 : pint;
        actor.set_text(pint.toString());
    },
    _setInt: function (entry, defval) {
        let pint = parseInt(entry.get_text());
        return pint != NaN && pint >= 0 ? pint : defval;
    },
    apply_settings: function () {
        this.cm.set_val('button_label', encodeURIComponent(this.ButtonLabel.get_text()), _("Menu"));
        this.cm.set_val('display_icon', this.displayIconSwitch.state, true);
        this.cm.set_val('is_hot_corner', this.hotCornerSwitch.state, true);
        this.cm.set_val('icon_name', this.IconNameEntry.get_text(), 'start-here');
        this.cm.set_val('main_icon_size', this._setInt(this.MainIconEntry, 18));
        this.cm.set_val('start_with_fav', this.startWithFavSwitch.state, true);
        this.cm.set_val('show_bottom_pane', this.showBottomSwitch.state, true);
        this.cm.set_val('display_activites', this.displayActivitesSwitch.state, true);
        this.cm.set_val('activites_position', this.activitesPositionSwitch.state, false);
        this.cm.set_val('main_box_width', this._setInt(this.mainBoxWidthEntry, 705));
        this.cm.set_val('left_pane_width', this._setInt(this.LeftBoxWidthEntry, 165));
        this.cm.set_val('display_places', this.displayPlacesSwitch.state, true);
        this.cm.set_val('display_bookmarks', this.displayBookmarksSwitch.state, true);
        this.cm.set_val('display_system', this.displaySystemSwitch.state, true);
        this.cm.set_val('display_search', this.displaySearchSwitch.state, true);
        this.cm.set_val('system_apps', this.cm.implode(',', this.SysAppsEntry.get_text()));
        this.cm.set_val('display_shutdown', this.displayShutdownSwitch.state, true);
        this.cm.set_val('show_left_pane', this.showLeftSwitch.state, true);
        this.cm.set_val('max_bookmarks', this._setInt(this.MaxBookmarksEntry, this.cm.defaultBookmarksCount));
        this.cm.set_val('searchentry_width', this._setInt(this.SearchWidthEntry, 240));
        this.cm.set_val('favorites_text', this.FavTextSwitch.state, true);
        this.cm.set_val('favorites_columns', this._setInt(this.FavColEntry, this.cm.defaultFavColumns));
        this.cm.set_val('favorites_icon_size', this._setInt(this.FavIconEntry, 68));
        this.cm.set_val('category_with_scroll', this.catWithScrollSwitch.state, false);
        this.cm.set_val('category_icon_size', this._setInt(this.CatIconEntry, 24));
        this.cm.set_val('leftpane_icon_size', this._setInt(this.LeftIconEntry, 22));
        this.cm.set_val('application_icon_size', this._setInt(this.AppIconEntry, 32));
        this.cm.set_val('categories_box_width', this._setInt(this.CatBoxWidthEntry, 180));
        this.cm.set_val('smart_height', this.smartHeightSwitch.state, true);
        this.cm.set_val('axe_in_hotcorner', this.axeCornerSwitch.state, false);
        this.cm.set_val('click_on_category', this.clickOnCategorySwitch.state, false);
        this.cm.set_val('search_tool', encodeURIComponent(this.SearchToolEntry.get_text()), "gnome-search-tool");
        this.cm.saveConfig();
    },
    resetToDefault: function () {
        this.notebook.clean();
        this.cm.resetToDefault();
        this._initControls(0);
    },
    save_settings: function () {
        this.apply_settings();
        this.close();
    },
    open: function () {
        try {
            this._initControls(0);
            ModalDialog.ModalDialog.prototype.open.call(this, global.get_current_time());
        }
        catch (e) {
            global.log(e);
        }
    },
    close: function () {
        try {
            this.notebook.clean();
            global.unset_cursor();
            ModalDialog.ModalDialog.prototype.close.call(this, global.get_current_time());
        }
        catch (e) {
            global.log(e);
        }
    }
};
