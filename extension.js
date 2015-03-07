
const Mainloop = imports.mainloop;
const GMenu = imports.gi.GMenu;
const Lang = imports.lang;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const AppFavorites = imports.ui.appFavorites;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GnomeSession = imports.misc.gnomeSession;
const Cairo = imports.cairo;
const GLib = imports.gi.GLib;
const Signals = imports.signals;
const Layout = imports.ui.layout;
const Gettext = imports.gettext;


/**
 * Current Extension namespace
 */
const Extension = imports.misc.extensionUtils.getCurrentExtension();
let ConfirmDialog = Extension.imports.common.ConfirmDialog;
let ConfigManager = Extension.imports.ConfigDialog.ConfigManager;
let ConfigDialog = Extension.imports.ConfigDialog.ConfigDialog;
let BaseButton = Extension.imports.common.BaseButton;
let ApplicationButton = Extension.imports.common.ApplicationButton;
let ToggleSwitch = Extension.imports.common.ToggleSwitch;
const Version = Extension.imports.common.Version;
const ShellVersion = Extension.imports.common.ShellVersion;
const cleanActor = Extension.imports.common.cleanActor;
const insert_actor_to_box = Extension.imports.common.insert_actor_to_box;

const _ = imports.gettext.domain('axemenu').gettext;

let appsys = Shell.AppSystem.get_default();
let _session = new GnomeSession.SessionManager();


let appsMenuButton;
let activitiesButton;
let activitiesButtonLabel;
let _installedChangedId;
let _favoritesChangedId;
let _bookmarksChangedId;
let hotCorner;
let extensionMeta, egoVersion;
let layoutManager;


const TextDirection = (ShellVersion[1] < 4) ? St.TextDirection.LTR : Clutter.TextDirection.LTR;
const getTextDirection = (ShellVersion[1] < 4) ? function (actor) {
    return actor.get_direction();
} : function (actor) {
    return actor.get_text_direction();
};

const HotCorner = new Lang.Class({
    Name: 'HotCorner',
    Extends: Layout.HotCorner,
    _init: function (axemenu) {
        this.axemenu = axemenu;
        this.parent( axemenu._layoutManager, axemenu._layoutManager.primaryMonitor, 0, 0);
        this.actor = new Clutter.Actor({ name: 'hot-corner-environs',
            x: this._x, y: this._y,
            width: 3,
            height: 3,
            reactive: true });

        this._corner = new Clutter.Rectangle({ name: 'hot-corner',
            width: 1,
            height: 1,
            opacity: 0,
            reactive: true });
        this._corner._delegate = this;

        this.actor.add_child(this._corner);
        axemenu._layoutManager.addChrome(this.actor);

        if (Clutter.get_default_text_direction() == Clutter.TextDirection.RTL) {
            this._corner.set_position(this.actor.width - this._corner.width, 0);
            this.actor.set_anchor_point_from_gravity(Clutter.Gravity.NORTH_EAST);
        } else {
            this._corner.set_position(0, 0);
        }

        this.actor.connect('leave-event',
            Lang.bind(this, this._onEnvironsLeft));
        this._corner.connect('enter-event',
            Lang.bind(this, this._onCornerEntered));
        this._corner.connect('leave-event',
            Lang.bind(this, this._onCornerLeft));
    },
    _onCornerEntered: function () {
        if (!this._entered) {
            this._entered = true;
            if (!Main.overview.animationInProgress) {
                this._rippleAnimation();
                this._activationTime = Date.now() / 1000;
                if (!this.axemenu.cm.axe_in_hotcorner) {
                    Main.overview.toggle();
                } else {
                    this.axemenu.toggleMenu();
                }
            }
        }
        return false;
    }
});

function PlaceButton(place, button_name, iconSize) {
    this._init(place, button_name, iconSize);
}
PlaceButton.prototype = {
    _init: function (place, button_name, iconSize) {
        this.place = place;
        this.button_name = button_name;
        this.actor = new St.Button({ reactive: true, label: this.button_name, style_class: 'application-button', x_align: St.Align.START });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        this.label = new St.Label({ text: this.button_name, style_class: 'application-button-label' });
        if (!this.place.is_native()){
            this.icon =  new St.Icon({gicon:new Gio.ThemedIcon({ name: 'folder-remote-symbolic' }), icon_size: iconSize});
        }
        else {
            try {
                let info = this.place.query_info('standard::symbolic-icon', 0, null);
                let symbIcon = info.get_symbolic_icon();
                this.icon = new St.Icon({gicon:symbIcon, icon_size: iconSize});
            }
            catch (e) {
                this.icon = new St.Icon({gicon:new Gio.ThemedIcon({ name: 'folder-symbolic' }), icon_size: iconSize});
            }
        }
        this.buttonbox.add_actor(this.icon);
        this.buttonbox.add(this.label, { y_align: St.Align.MIDDLE, y_fill: false });
        this.actor.set_child(this.buttonbox);
        this.actor.connect('clicked', Lang.bind(this, function () {
            let launchContext = global.create_app_launch_context(0, -1);
            Gio.AppInfo.launch_default_for_uri(place.get_uri(), launchContext);
            appsMenuButton.menu.close();
        }));
        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
    },
    _onDestroy: function () {
        if (this._clickEventId)
            this.actor.disconnect(this._clickEventId);
    }
};
Signals.addSignalMethods(PlaceButton.prototype);

function CategoryButton(parent, category, iconSize) {
    this._init(parent, category, iconSize);
}
CategoryButton.prototype = {
    _init: function (parent, category, iconSize) {
        var label;
        this._parent = parent;
        this.category = category;
        if (category) {
            this.menu_id = this.category.get_menu_id();
            let icon = category.get_icon();
            if (icon && icon.get_names)
                this.icon_name = icon.get_names().toString();
            else
                this.icon_name = "";
            label = category.get_name();
        } else {
            label = _("All applications");
            this.menu_id = '';
        }
        this.actor = new St.Button({ reactive: true, label: label, style_class: 'category-button', x_align: St.Align.START });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        this.label = new St.Label({ text: label, style_class: 'category-button-label' });
        if (category && this.icon_name) {
            this.icon = new St.Icon({icon_name: this.icon_name, icon_size: iconSize});

        } else {
            this.icon = new St.Icon({icon_name: 'start-here-symbolic', icon_size: iconSize});
        }
        this.buttonbox.add_actor(this.icon);
        this.buttonbox.add(this.label, { y_align: St.Align.MIDDLE, y_fill: false });
        this.actor.set_child(this.buttonbox);

        this._clickEventId = this.actor.connect('clicked', Lang.bind(this, function () {
            this._parent._select_category(this.category, this);
            this._parent.cm.set_val('category_menu_id', this.menu_id);
            this._parent._scrollToCatButton(this);
            this._parent.selectedAppTitle.set_text("");
            this._parent.selectedAppDescription.set_text("");
        }));
        if (!parent.cm.click_on_category)
            this._parent._addEnterEvent(this, Lang.bind(this, function () {
                this._parent._select_category(this.category, this);
                this._parent.cm.set_val('category_menu_id', this.menu_id);
                this._parent.selectedAppTitle.set_text("");
                this._parent.selectedAppDescription.set_text("");
            }));
        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
    },
    _onDestroy: function () {
        if (this._clickEventId)
            this.actor.disconnect(this._clickEventId);
    }
};

Signals.addSignalMethods(CategoryButton.prototype);

function FavoritesButton(app, iconSize, favoritesText, applicationsButton) {
    this._init(app, iconSize, favoritesText, applicationsButton);
}
FavoritesButton.prototype = {
    _init: function (app, iconSize, favoritesText, applicationsButton) {
        this._app = app;
        this.actor = new St.Button({ reactive: true, style_class: 'applications-menu-favorites-button', x_align: favoritesText ? St.Align.START : St.Align.MIDDLE });
        this.actor._delegate = this;
        this.buttonbox = new St.BoxLayout();
        this.icon = this._app.create_icon_texture(iconSize);
        this.buttonbox.add_actor(this.icon);
        if (favoritesText) {
            this.label = new St.Label({ text: this._app.get_name(), style_class: 'favorites-button-label' });
            this.buttonbox.add(this.label, { y_align: St.Align.MIDDLE, y_fill: false });
        }
        this.actor.set_child(this.buttonbox);
        this._releaseEventId = this.actor.connect('button-release-event', Lang.bind(this, this._onButtonRelease));
        this._clickEventId = this.actor.connect('clicked', Lang.bind(this, function () {
            this._app.open_new_window(-1);
            applicationsButton.menu.close();
        }));
        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));
    },
    _onButtonRelease: function (actor, event) {
        let button = event.get_button();
        if (button == 3) {
            if (typeof this._confirmDialog == 'undefined') {
                this._confirmDialog = new ConfirmDialog(this._app);
            }
            this._confirmDialog.open();
        }
    },
    _onDestroy: function () {
        if (this._clickEventId) this.actor.disconnect(this._clickEventId);
        if (this._releaseEventId) this.actor.disconnect(this._releaseEventId);
    }
};
Signals.addSignalMethods(FavoritesButton.prototype);



function AxeButton(menuAlignment) {
    this._init(menuAlignment);
}
AxeButton.prototype = {
    __proto__: PanelMenu.Button.prototype,
    _init: function (menuAlignment) {
        PanelMenu.Button.prototype._init.call(this, menuAlignment, 'axeMenu', false);
        this._menuAlignment = menuAlignment;
        this._resetMenu();
        if (ShellVersion[1] < 4) {
            //gconftool-2 -s --type string "/apps/metacity/global_keybindings/run_command_12" 'Super_R'
            global.window_manager.takeover_keybinding('run_command_12');
            this._keyBindingId = global.window_manager.connect('keybinding::run_command_12', function () {
                appsMenuButton.toggleMenu();
            });
        } else {
            global.display.add_keybinding('axemenu-toggle', this._getSettings(), 0, function () {
                appsMenuButton.toggleMenu();
            });
        }
    },
    _getSettings: function () {
        let source = Gio.SettingsSchemaSource.new_from_directory(extensionMeta.path + "/schemas", Gio.SettingsSchemaSource.get_default(), false);
        let schema = source.lookup('org.gnome.shell.extensions.axemenu.keybindings', false);
        return new Gio.Settings({settings_schema: schema});
    },
    toggleMenu: function () {
        if (!this.menu.isOpen) {
            let monitor = this._layoutManager.primaryMonitor;
            this.menu.actor.style = ('max-height: ' + Math.round(monitor.height - Main.panel.actor.height - 80) + 'px;');
        } else {
            this.reloadFlag = false;
            this.cm.saveConfig();
        }
        this.menu.toggle();
    },
    _resetMenu: function () {
	    this.setMenu(new PopupMenu.PopupMenu(this.actor, this._menuAlignment, St.Side.TOP));
	    Main.panel.menuManager.addMenu(this.menu);
    },
    _onButtonPress: function (actor, event) {
        let button = event.get_button();
        if (button == 1) {
            this.toggleMenu();
        }
        else if (button == 3) {
            this._configDialog = new ConfigDialog(this.cm);
            this._configDialog.open();
        }
    },
    _onSourceKeyPress: function (actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return) {
            this.menu.toggle();
            return true;
        } else if (symbol == Clutter.KEY_Escape && this.menu.isOpen) {
            this.menu.close();
            return true;
        } else if (symbol == Clutter.KEY_Down) {
            if (!this.menu.isOpen){
                this.menu.toggle();
            }
            this.menu.actor.navigate_focus(this.actor, Gtk.DirectionType.DOWN, false);
            return true;
        } else
            return false;
    },
    _onOpenStateChanged: function (menu, open) {
        if (open)
            this.actor.add_style_pseudo_class('active');
        else
            this.actor.remove_style_pseudo_class('active');
    },
    destroy: function () {

        this.actor._delegate = null;
        this._monitor.disconnect(this._monitorChangedId);
        this.menu.actor.get_children().forEach(function (c) {
            c.destroy()
        });
        this.menu.destroy();
        if (ShellVersion[1] < 4)
            global.window_manager.disconnect(this._keyBindingId);
        else
            global.display.remove_keybinding('axemenu-toggle');
        this.actor.destroy();
    }
};
Signals.addSignalMethods(AxeButton.prototype);

function ApplicationsButton(activitiesButton, layoutManager) {

    this._init(activitiesButton, layoutManager);
}
ApplicationsButton.prototype = {
    __proto__: AxeButton.prototype,
    _init: function (activitiesButton, layoutManager) {
        AxeButton.prototype._init.call(this, 1);
        this._activitiesButton = activitiesButton;
        this._layoutManager = layoutManager;
        let container = new Shell.GenericContainer();
        container.connect('get-preferred-width', Lang.bind(this, this._containerGetPreferredWidth));
        container.connect('get-preferred-height', Lang.bind(this, this._containerGetPreferredHeight));
        container.connect('allocate', Lang.bind(this, this._containerAllocate));
        this.actor.add_actor(container);
        this._box = new St.BoxLayout({ name: 'axeMenu' });
        this._iconBox = new St.Bin();
        this._box.add(this._iconBox, { y_align: St.Align.MIDDLE, y_fill: false });
        this._icon = new St.Icon({ icon_name: 'start-here-symbolic', icon_size: 18,style_class: 'axemenu-icon' });
        this._iconBox.child = this._icon;
        this._label = new St.Label({ track_hover: true, style_class: 'application-menu-button-label'});
        this._box.add(this._label, { y_align: St.Align.MIDDLE, y_fill: false });
        this._label.set_text(_("Menu"));
        container.add_actor(this._box);
        this._hotCorner = new HotCorner(this);

        this._searchInactiveIcon = new St.Icon({ style_class: 'search-entry-icon', icon_name: 'edit-find'});
        this._searchActiveIcon = new St.Icon({ style_class: 'search-entry-icon', icon_name: 'edit-clear'});

        this._searchTimeoutId = 0;
        this._searchIconClickedId = 0;
        this._selectedItemIndex = null;
        this._favSelectedItemIndex = null;
        this._previousSelectedItemIndex = null;
        this._activeContainer = null;
        this.cm = new ConfigManager(this);
        this.reloadFlag = true;

        this._createLayout();
        this._display();
        _installedChangedId = appsys.connect('installed-changed', Lang.bind(this, this.reDisplay));
        _favoritesChangedId = AppFavorites.getAppFavorites().connect('changed', Lang.bind(this, this.reDisplay));

        this._bookmarksFile = this._findBookmarksFile();
        if (this._bookmarksFile){
            this._monitor = this._bookmarksFile.monitor_file(Gio.FileMonitorFlags.NONE, null);
            this._monitor.connect('changed', Lang.bind(this, function () {
                if (this._bookmarkTimeoutId > 0)
                    return;
                /* Defensive event compression */
                this._bookmarkTimeoutId = Mainloop.timeout_add(100, Lang.bind(this, function () {
                    this._bookmarkTimeoutId = 0;
                    this.reDisplay();
                    return false;
                }));
            }));

            this.reDisplay();
        }
        this.menu.connect('open-state-changed', Lang.bind(this, this._onOpenStateToggled));
        this._monitor = Gio.file_new_for_path(this.cm.config_file).monitor(Gio.FileMonitorFlags.NONE, null);
        this._monitorChangedId = this._monitor.connect('changed', Lang.bind(this, this.reDisplay));
    },
    _containerGetPreferredWidth: function (actor, forHeight, alloc) {
        [alloc.min_size, alloc.natural_size] = this._box.get_preferred_width(forHeight);
    },
    _containerGetPreferredHeight: function (actor, forWidth, alloc) {
        [alloc.min_size, alloc.natural_size] = this._box.get_preferred_height(forWidth);
    },
    _containerAllocate: function (actor, box, flags) {
        this._box.allocate(box, flags);
        let primary = this._layoutManager.primaryMonitor;
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
    _createNetwork: function () {
	    var self = this;
        let button = new BaseButton(_("Network"), 'network-workgroup-symbolic', this.cm.leftpane_icon_size, null, function () {
            Main.Util.spawnCommandLine("nautilus network:///");
            self.menu.toggle();
        });
        return button.actor;
    },
    _createSearch: function () {
	    var self = this;
        let button = new BaseButton(_("Search"), 'edit-find-symbolic', 22, null, function () {
            Main.Util.spawnCommandLine(self.cm.search_tool);
            self.menu.close();
        });
        return button.actor;
    },
    _createSettingsButton: function () {
        let buttonContainer = new St.BoxLayout({style: "padding: 10px 0 0 10px;", opacity: 120});
        let button = new BaseButton('', 'system-run', 18, null, function () {
            appsMenuButton._configDialog = new ConfigDialog(appsMenuButton.cm);
            appsMenuButton._configDialog.open();
            appsMenuButton.menu.close();
        });
        button.actor.connect('enter-event', Lang.bind(this, function () {
            this.selectedAppTitle.set_text(_("AxeMenu settings"));
        }));
        button.actor.connect('leave-event', Lang.bind(this, function () {
            this.selectedAppTitle.set_text("");
        }));
        buttonContainer.add(button.actor);
        return buttonContainer;
    },
    _createComputer: function () {
        let button = new BaseButton(_("Computer"), 'computer-symbolic', this.cm.leftpane_icon_size, null, function () {
            Main.Util.spawnCommandLine("nautilus computer://");
            appsMenuButton.menu.close();
        });
        return button.actor;
    },
    _createHome: function () {
        let button = new BaseButton(_("Home Folder"), 'user-home-symbolic', this.cm.leftpane_icon_size, null, function () {
            Main.Util.spawnCommandLine("nautilus");
            appsMenuButton.menu.close();
        });
        return button.actor;
    },
    _createDesktop: function () {
        let button = new BaseButton(_("Desktop"), 'user-desktop-symbolic', this.cm.leftpane_icon_size, null, function () {
            let desktop_folder = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DESKTOP);
            Main.Util.spawnCommandLine("nautilus \"" + desktop_folder.replace(" ", "\ ") + "\"");
            appsMenuButton.menu.close();
        });
        return button.actor;
    },
    _createSeparator: function () {
        let separator = new St.DrawingArea({ style_class: 'popup-separator-menu-item' });
        separator.connect('repaint', Lang.bind(this, this._onRepaintSeparator));
        return separator;
    },
    _onRepaintSeparator: function (area) {
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
    _findBookmarksFile: function() {
        let paths = [
            GLib.build_filenamev([GLib.get_user_config_dir(), 'gtk-3.0', 'bookmarks']),
            GLib.build_filenamev([GLib.get_home_dir(), '.gtk-bookmarks']),
        ];

        for (let i = 0; i < paths.length; i++) {
            if (GLib.file_test(paths[i], GLib.FileTest.EXISTS))
                return Gio.File.new_for_path(paths[i]);
        }

        return null;
    },
    _onMenuKeyPress: function (actor, event) {
        let symbol = event.get_key_symbol();
        if (symbol == Clutter.KEY_Super_R) {
            this.menu.close();
            return true;
        }
        if (symbol == Clutter.KEY_Tab) {
            this.favoritesSwith.emit('clicked', 1);
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
        } else if (this._activeContainer === null) {
            this._activeContainer = this.categoriesBox;
            this._selectedItemIndex = -1;
            this._previousSelectedItemIndex = -1;
        } else if (this._activeContainer == this.favoritesTable) {
            this._favSelectedItemIndex = this._favSelectedItemIndex === null ? -1 : this._favSelectedItemIndex;
            children = this._activeContainer.get_children();
        }
        let children = this._activeContainer.get_children();
        if (children.length == 0) {
            this._activeContainer = this.categoriesBox;
            this._selectedItemIndex = -1;
            this._previousSelectedItemIndex = -1;
            children = this._activeContainer.get_children();
        }
        if (this._activeContainer != this.favoritesTable) {
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
            if (index >= children.length) index = children.length - 1;
            this._selectedItemIndex = index;

            let item_actor = children[this._selectedItemIndex];
            if (!item_actor || item_actor === this.searchEntry) {
                return false;
            }
            if (!item_actor._delegate) {
                if (symbol == Clutter.KEY_Down) {
                    ++this._selectedItemIndex;
                    item_actor = children[this._selectedItemIndex];
                } else if (symbol == Clutter.KEY_Up) {
                    --this._selectedItemIndex;
                    item_actor = children[this._selectedItemIndex];
                }
            }
            if (this._activeContainer === this.categoriesBox && this.cm.click_on_category)
                item_actor.emit('clicked', 1);
            else
                item_actor._delegate.emit('enter-event');
        } else {
            let index = this._favSelectedItemIndex;
            if (symbol == Clutter.KEY_Up || symbol == Clutter.KEY_Left) {
                index = this._favSelectedItemIndex - 1 < 0 ? 0 : this._favSelectedItemIndex - 1;
            } else if (symbol == Clutter.KEY_Down || symbol == Clutter.KEY_Right) {
                index = this._favSelectedItemIndex + 1 == children.length ? children.length - 1 : this._favSelectedItemIndex + 1;
            } else if (this._favSelectedItemIndex >= 0 && (symbol == Clutter.KEY_space || symbol == Clutter.KEY_Return || symbol == Clutter.KP_Enter)) {
                let item_actor = children[this._favSelectedItemIndex];
                item_actor.emit('clicked', 1);
                return true;
            } else {
                return false;
            }
            if (index == this._favSelectedItemIndex) {
                return true;
            }
            if (index >= children.length) index = children.length - 1;
            this._favSelectedItemIndex = index;
            let item_actor = children[this._favSelectedItemIndex];
            if (!item_actor || item_actor === this.searchEntry) {
                return false;
            }
            item_actor._delegate.emit('enter-event');
        }
        return true;
    },
    _addEnterEvent: function (button, callback) {
        let _callback = Lang.bind(this, function () {
            let parent = button.actor.get_parent();
            if (this._activeContainer === this.categoriesBox && parent !== this._activeContainer) {
                this._previousSelectedItemIndex = this._selectedItemIndex;
            }
            this._activeContainer = parent;
            if (this._activeContainer) {
                let children = this._activeContainer.get_children();
                for (let i = 0, l = children.length; i < l; i++) {
                    if (button.actor === children[i]) {
                        this._selectedItemIndex = i;
                    }
                }
                ;
            }
            callback();
        });
        button.connect('enter-event', _callback);
        button.actor.connect('enter-event', _callback);
    },
    _addFavEnterEvent: function (button, callback) {
        let _callback = Lang.bind(this, function () {
            let children = this._activeContainer.get_children();
            for (let i = 0, l = children.length; i < l; i++) {
                if (button.actor === children[i]) {
                    this._favSelectedItemIndex = i;
                }
            }
            ;
            callback();
        });
        button.connect('enter-event', _callback);
        button.actor.connect('enter-event', _callback);
    },
    _clearSelections: function (container) {
        container.get_children().forEach(function (actor) {
            if (actor.style_class != 'popup-separator-menu-item')
                actor.style_class = "category-button";
        });
    },
    _clearFavSelections: function () {
        this.favoritesTable.get_children().forEach(function (actor) {
            actor.remove_style_pseudo_class('hover');
        });
    },
    _onOpenStateToggled: function (menu, open) {
        if (open) {
            this.resetSearch();
            this._selectedItemIndex = null;
            this._favSelectedItemIndex = null;
            this._clearFavSelections();

            if (this.cm.start_with_fav) {
                this.favoritesBox.show();
                this.categoriesApplicationsBox.hide();
                this.favoritesSwith.set_label(_("All applications"));
                this._activeContainer = this.favoritesTable;
            } else {
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
    reDisplay: function (e, object, p0, p1) {
        if (this.reloadFlag && (p1 == 3 || p1 === undefined)) {
            this._cleanControls();
            this._display();
        }
        this.reloadFlag = true;
    },
    _cleanControls: function () {
        cleanActor(this.favoritesTable);
        cleanActor(this.categoriesBox);
        cleanActor(this.applicationsBox);
        cleanActor(this.leftPane);
    },
    _loadCategory: function (dir) {
        var iter = dir.iter();
        var nextType;
        while ((nextType = iter.next()) != GMenu.TreeItemType.INVALID) {
            if (nextType == GMenu.TreeItemType.ENTRY) {
                var entry = iter.get_entry();
                if (!entry.get_app_info().get_nodisplay()) {
                    var app = appsys.lookup_app(entry.get_desktop_file_id());
                    if (!this.applicationsByCategory[dir.get_menu_id()]) this.applicationsByCategory[dir.get_menu_id()] = new Array();
                    this.applicationsByCategory[dir.get_menu_id()].push(app);
                }
            } else if (nextType == GMenu.TreeItemType.DIRECTORY) {
                let subdir = iter.get_directory();
                if (subdir.get_is_nodisplay()) continue;
                this.applicationsByCategory[subdir.get_menu_id()] = new Array();
                this._loadCategory(subdir);
                if (this.applicationsByCategory[subdir.get_menu_id()].length > 0) {
                    let categoryButton = new CategoryButton(this, subdir, this.cm.category_icon_size);
                    if (subdir.get_menu_id() == this.cm.stored_category_id) {
                        this._select_category(categoryButton.category, categoryButton);
                        categoryButton.actor.style_class = "category-button-selected";
                        this._scrollToCatButton(categoryButton);
                    }
                    this.categoriesBox.add_actor(categoryButton.actor);
                }
            }
        }
    },
    _scrollToButton: function (button) {
        var current_scroll_value = this.applicationsScrollBox.get_vscroll_bar().get_adjustment().get_value();
        var box_height = this.applicationsScrollBox.get_allocation_box().y2 - this.applicationsScrollBox.get_allocation_box().y1;
        var new_scroll_value = current_scroll_value;
        if (current_scroll_value > button.actor.get_allocation_box().y1 - 10) new_scroll_value = button.actor.get_allocation_box().y1 - 10;
        if (box_height + current_scroll_value < button.actor.get_allocation_box().y2 + 10) new_scroll_value = button.actor.get_allocation_box().y2 - box_height + 10;
        if (new_scroll_value != current_scroll_value) this.applicationsScrollBox.get_vscroll_bar().get_adjustment().set_value(new_scroll_value);
    },
    _scrollToCatButton: function (button) {
        var current_scroll_value = this.categoriesScrollBox.get_vscroll_bar().get_adjustment().get_value();
        var box_height = this.categoriesScrollBox.get_allocation_box().y2 - this.categoriesScrollBox.get_allocation_box().y1;
        var new_scroll_value = current_scroll_value;
        if (current_scroll_value > button.actor.get_allocation_box().y1 - 10) new_scroll_value = button.actor.get_allocation_box().y1 - 10;
        if (box_height + current_scroll_value < button.actor.get_allocation_box().y2 + 10) new_scroll_value = button.actor.get_allocation_box().y2 - box_height + 10;
        if (new_scroll_value != current_scroll_value) this.categoriesScrollBox.get_vscroll_bar().get_adjustment().set_value(new_scroll_value);
    },
    _createLayout: function () {
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
        this.searchBox.add(this._buttonLayout, { expand: true, x_align: St.Align.END, y_align: St.Align.MIDDLE });
        this.favoritesSwith.connect('clicked', Lang.bind(this, function () {
            if (this.favoritesBox.visible) {
                this.favoritesBox.hide();
                this._activeContainer = null;
                this.categoriesApplicationsBox.show();
                this.favoritesSwith.set_label(_("Favorites"));

            } else {
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
        this.rightPane.add(this.categoriesApplicationsBox, { expand: true, x_fill: true, y_fill: true });
        this.categoriesBox = new St.BoxLayout({ style_class: 'categories-box', vertical: true });
        this.applicationsScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'vfade applications-scrollbox' });
        let vscroll = this.applicationsScrollBox.get_vscroll_bar();
        vscroll.connect('scroll-start', Lang.bind(this, function () {
            this.menu.passEvents = true;
        }));
        vscroll.connect('scroll-stop', Lang.bind(this, function () {
            this.menu.passEvents = false;
        }));
        this.categoriesScrollBox = new St.ScrollView({ x_fill: true, y_fill: false, y_align: St.Align.START, style_class: 'vfade categories-scrollbox' });
        vscroll = this.categoriesScrollBox.get_vscroll_bar();
        vscroll.connect('scroll-start', Lang.bind(this, function () {
            this.menu.passEvents = true;
        }));
        vscroll.connect('scroll-stop', Lang.bind(this, function () {
            this.menu.passEvents = false;
        }));
        this.applicationsBox = new St.BoxLayout({ style_class: 'applications-box', vertical: true });
        this.applicationsScrollBox.add_actor(this.applicationsBox);
        this.categoriesScrollBox.add_actor(this.categoriesBox, { expand: true, x_fill: false });
        this.applicationsScrollBox.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC);
        this.categoriesApplicationsBox.add(this.categoriesScrollBox, { expand: false, x_fill: true, y_fill: false, y_align: St.Align.START });
        this.categoriesApplicationsBox.add(this.applicationsScrollBox, { expand: true, x_fill: true, y_fill: true });
        this.mainBox = new St.BoxLayout({ style_class: 'main-box', vertical: false });
        this.favoritesBox.add_actor(this.favoritesTable);
        this.rightPane.add_actor(this.favoritesBox, { expand: true, x_fill: false, y_fill: false });
        this.mainBox.add(this.leftPane, { expand: false, x_fill: false, y_fill: false, y_align: St.Align.START });
        this.mainBox.add(this.rightPane, { expand: true, x_fill: true, y_fill: true });
        section.actor.add_actor(this.mainBox);
        this.selectedAppBox = new St.BoxLayout({ style_class: 'selected-app-box', vertical: true });
        this.selectedAppTitle = new St.Label({ style_class: 'selected-app-title', text: "" });
        this.selectedAppBox.add_actor(this.selectedAppTitle);
        this.selectedAppDescription = new St.Label({ style_class: 'selected-app-description', text: "" });
        this.selectedAppBox.add_actor(this.selectedAppDescription);
        this.settingsAndselectedAppBox = new St.BoxLayout();
        this.settingsAndselectedAppBox.add(this._createSettingsButton(), { expand: false, x_fill: false, y_fill: false, y_align: St.Align.END });
        this.settingsAndselectedAppBox.add(this.selectedAppBox, { expand: true, x_fill: true, y_fill: true });
        section.actor.add_actor(this.settingsAndselectedAppBox);
    },
    _display: function () {
        this.cm.loadConfig();
        this._activeContainer = null;
        this._applicationsButtons = new Array();
        this.leftPane.style = ('width: ' + this.cm.left_pane_width + 'px;');
        this.categoriesScrollBox.style = ('width: ' + this.cm.categories_box_width + 'px;');
        this.mainBox.style = ('width: ' + this.cm.main_box_width + 'px;');
        this.searchActive = false;
        this.searchEntry.width = this.cm.searchentry_width;
        if (this.cm.show_left_pane)
            this.leftPane.show();
        else
            this.leftPane.hide();
        if (this.cm.show_bottom_pane){
            this.settingsAndselectedAppBox.show();
        }
        else
            this.settingsAndselectedAppBox.hide();
        this._previousSearchPattern = "";
        this.categoriesApplicationsBox.hide();

        //Load favorites
        let launchers = global.settings.get_strv('favorite-apps');
        let appSys = Shell.AppSystem.get_default();
        let j = 0;
        let column = 0;
        let rownum = 0;
        for (let i = 0; i < launchers.length; ++i) {
            let app = appSys.lookup_app(launchers[i]);
            if (app) {
                let button = new FavoritesButton(app, this.cm.favorites_icon_size, this.cm.favorites_text, this);
                this.favoritesTable.add(button.actor, { row: rownum, col: column });
                this._addFavEnterEvent(button, Lang.bind(this, function () {
                    this.selectedAppTitle.set_text(button._app.get_name());
                    if (button._app.get_description()) this.selectedAppDescription.set_text(button._app.get_description());
                    else this.selectedAppDescription.set_text("");
                    this._clearFavSelections();
                    button.actor.add_style_pseudo_class('hover');
                }));
                button.actor.connect('leave-event', Lang.bind(this, function () {
                    this.selectedAppTitle.set_text("");
                    this.selectedAppDescription.set_text("");
                }));
                ++j;
                ++column;
                if (column == this.cm.favorites_columns) {
                    column = 0;
                    ++rownum;
                }
            }
        }
        //Load left
        if (this.cm.display_places) {
            this.leftPane.add(new St.Label({ style_class: 'pane-title', opacity: 180, text: _("Places") }));
            this.leftPane.add_actor(this._createComputer());
            this.leftPane.add_actor(this._createHome());
            this.leftPane.add_actor(this._createDesktop());
            this.leftPane.add_actor(this._createNetwork());
        }
        if (this.cm.display_bookmarks) {
            let bookmarks = this._listBookmarks();
            this.leftPane.add(new St.Label({ style_class: 'pane-title', opacity: 180, text: _("Bookmarks") }));
            for (var i = 0; i < bookmarks.length; i++) {
                let place = bookmarks[i];
                let button = new PlaceButton(place.file, place.name, this.cm.leftpane_icon_size);
                this.leftPane.add_actor(button.actor);
            }
        }
        if (this.cm.display_system) {
            let sysTitle = new St.Label({ style_class: 'pane-title', opacity: 180, text: _("System") });
            this.leftPane.add(sysTitle);
            for (var i = 0; i < this.cm.system_apps.length; i++) {
                let app = appsys.lookup_app(this.cm.system_apps[i] + '.desktop');
                if (app) {
                    let button = new ApplicationButton(app, this.cm.leftpane_icon_size, this);
                    this.leftPane.add_actor(button.actor);
                }
            }
            if (this.cm.display_search)
                this.leftPane.add_actor(this._createSearch());
        }
        if (this.cm.display_shutdown) {
            this.leftPane.add(this._createSeparator(), { span: -1 });
            let reexecButton = new BaseButton(_("Restart Shell"), "view-refresh", 20, null, function () {
                appsMenuButton.menu.close();
                appsMenuButton.reloadFlag = false;
                appsMenuButton.cm.saveConfig();
                global.reexec_self();
            });
            this.leftPane.add_actor(reexecButton.actor);

            let logoutButton = new BaseButton(_("Logout"), "user-offline-symbolic", 20, null, function () {
                _session.LogoutRemote(0);
                appsMenuButton.menu.close();
            });
            this.leftPane.add_actor(logoutButton.actor);

            let exitButton = new BaseButton(_("Power Off"), "system-shutdown-symbolic", 20, null, function () {
                _session.ShutdownRemote();
                appsMenuButton.menu.close();
            });
            this.leftPane.add_actor(exitButton.actor);
        }
        //Load categories
        this.applicationsByCategory = {};
	    let tree = new GMenu.Tree({menu_basename:'applications.menu'});
	    tree.load_sync();
        let root = tree.get_root_directory();
        let categoryButton = new CategoryButton(this, null, this.cm.category_icon_size);
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
                if (this.applicationsByCategory[dir.get_menu_id()].length > 0) {
                    let categoryButton = new CategoryButton(this, dir, this.cm.category_icon_size);
                    if (dir.get_menu_id() == this.cm.stored_category_id) {
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
        if (this.cm.smart_height) {
            let catHeight = this.categoriesBox.height + 45;
            if (this.cm.category_with_scroll)
                catHeight = 0;
            let leftHeight = this.leftPane.height;
            if (!this.cm.show_left_pane)
                leftHeight = 0;
            smartHeight = Math.max(this.favoritesBox.height + 20, catHeight, leftHeight) + 20 + 'px;';
        } else {
            smartHeight = 'auto;';
        }
        this.mainBox.style += ('height: ' + smartHeight);
    },
    _clearApplicationsBox: function (selectedActor) {
        let actors = this.applicationsBox.get_children();
        for (var i = 0; i < actors.length; i++) {
            let actor = actors[i];
            this.applicationsBox.remove_actor(actor);
        }
        let actors = this.categoriesBox.get_children();
        for (var i = 0; i < actors.length; i++) {
            let actor = actors[i];
            if (actor.style_class != "popup-separator-menu-item")
                if (actor == selectedActor) actor.style_class = "category-button-selected";
                else actor.style_class = "category-button";
        }
    },
    _select_category: function (dir, categoryButton) {
        this.resetSearch();
        this._clearApplicationsBox(categoryButton.actor);
        if (dir) this._displayButtons(this._listApplications(dir.get_menu_id()));
        else this._displayButtons(this._listApplications(null));
    },
    _displayButtons: function (apps) {
        if (apps) {
            for (var i = 0; i < apps.length; i++) {
                let app = apps[i];
                if (!this._applicationsButtons[app]) {
                    let applicationButton = new ApplicationButton(app, this.cm.application_icon_size, this);
                    applicationButton.actor.connect('leave-event', Lang.bind(this, function () {
                        this.selectedAppTitle.set_text("");
                        this.selectedAppDescription.set_text("");
                    }));
                    this._addEnterEvent(applicationButton, Lang.bind(this, function () {
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
    resetSearch: function () {
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
                    Lang.bind(this, function () {
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
    _listBookmarks: function (pattern) {
        if (!this._bookmarksFile) return [];
        let content = Shell.get_file_contents_utf8_sync(this._bookmarksFile.get_path());
        let lines = content.split('\n');

        let bookmarks = [];
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            let components = line.split(' ');
            let bookmark = components[0];

            if (!bookmark)
                continue;

            let file = Gio.File.new_for_uri(bookmark);
            if (file.is_native() && !file.query_exists(null))
                continue;

            let duplicate = false;
            if (duplicate)
                continue;
            for (let i = 0; i < bookmarks.length; i++) {
                if (file.equal(bookmarks[i].file)) {
                    duplicate = true;
                    break;
                }
            }
            if (duplicate)
                continue;

            let label = null;
            if (components.length > 1){
                label = components.slice(1).join(' ');
            }
            else {
                var parts = line.split('/');
                label = decodeURIComponent(parts[parts.length-1]);
            }

            bookmarks.push({file: file, name: label});
        }

        return bookmarks;
    },
    _listDevices: function (pattern) {
        return [];
    },
    _listApplications: function (category_menu_id, pattern) {
        var applist;
        if (category_menu_id) applist = this.applicationsByCategory[category_menu_id];
        else {
            applist = new Array();
            for (directory in this.applicationsByCategory) {
                applist = applist.concat(this.applicationsByCategory[directory]);
            }
        }
        var res;
        if (pattern) {
            res = new Array();
            for (var i in applist) {
                let app = applist[i];
                if (app.get_name().toLowerCase().indexOf(pattern) != -1 || (app.get_description() && app.get_description().toLowerCase().indexOf(pattern) != -1)) res.push(app);
            }
        } else res = applist;
        res.sort(function (a, b) {
            return a.get_name().toLowerCase() > b.get_name().toLowerCase();
        });
        return res;
    },
    _doSearch: function () {
        this._searchTimeoutId = 0;
        let pattern = this.searchEntryText.get_text().replace(/^\s+/g, '').replace(/\s+$/g, '').toLowerCase();
        if (pattern == this._previousSearchPattern) return false;
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
        if (actors[0])
            actors[0]._delegate.emit('enter-event');
        return false;
    },
    getActivitiesButton: function (){
        return activitiesButton;
    }
};



function enable() {

    activitiesButton = Main.panel.statusArea['activities'];
    activitiesButtonLabel = activitiesButton._label.get_text();

    layoutManager  = Main.layoutManager;

    hotCorner = layoutManager.hotCorners[0];

    //TODO Do something with hot corner, for now its is always on
    //hotCorner.destroy();
    appsMenuButton = new ApplicationsButton(activitiesButton, layoutManager);
    Main.panel._addToPanelBox('axeMenu', appsMenuButton, 0, Main.panel._leftBox);
    //Main.panel.addToStatusArea('axeMenu', appsMenuButton, 0, 'left');
    //Main.panel.actor.remove_actor(activitiesButton.actor);
    if (!appsMenuButton.cm.display_activites) {
        activitiesButton.actor.hide();
    }
    activitiesButton._label.set_text("\u2318");
}

function disable() {
    //hotCorner.actor.show();
    if (appsMenuButton.cm.display_activites) Main.panel._rightBox.remove_actor(activitiesButton.actor);
    insert_actor_to_box(Main.panel._leftBox, activitiesButton.actor, 0);
    activitiesButton._label.set_text(activitiesButtonLabel);
    appsys.disconnect(_installedChangedId);
    AppFavorites.getAppFavorites().disconnect(_favoritesChangedId);
    appsMenuButton.destroy();
    activitiesButton.actor.show();
}

function init(metadata) {
    let localePath = metadata.path + '/locale';
    extensionMeta = metadata;
    egoVersion = ShellVersion[1] < 4 ? metadata.version : metadata.metadata['version'];
    Gettext.bindtextdomain('axemenu', localePath);
}
