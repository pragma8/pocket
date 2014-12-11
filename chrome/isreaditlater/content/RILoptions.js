function RILoptions() {
    this.checkmarks = {};
    this.drops = {};
    this.texts = {};
    this.gVKNames = {};
    this.keysDown = [];
}
RILoptions.prototype = {
    
    init : function()
    {
	if (!RIL.inited) RIL.init();
	
		if (!RIL.APP.showLoginPromptIfNeeded())
		{
			window.close();
			return;
		}
	
        // Configure each tab
        this.configureAccount();
        this.configureOffline();
        this.configureApps();
        this.configureKeyboard();
        this.configureTweaks();
        this.configureAppearance();
        this.configureDebug();
        
        // Present a the default tab
	let defaultTab = window.arguments && window.arguments[0] ? window.arguments[0] : 'account';
        this.selectTab( defaultTab );
    },
    
    selectTab : function(tab)
    {
        if (this.currentTab && this.currentTab.value == tab) return;
        
        if (this.currentTab)
            this.currentTab.hidden = true;
        
        this.currentTab = RIL.xul('options_'+tab);
        RIL.xul('options_menu').selectedItem = RIL.xul('options_menu_'+tab);
        this.currentTab.hidden = false;
        
        if (tab == 'love')
            RIL.APP.SYNC.tk(8,1,1,0);
        else if (tab == 'apps')
            RIL.APP.SYNC.tk(12,1,0,0); 
        
    },
    
    accept : function()
    {
        // Save settings
        try {
            
            // Old vars for compare
            let oldStoreSecurely = RIL.APP.PREFS.getBool('storeSecurely');
            let oldLogin = RIL.APP.getLogin();
            
            
	    // Clean/validate data
	    this.validatePerPage();
	    
	    
	    // Save form controls
            let i;
            for(i in this.checkmarks)
            {
                RIL.APP.PREFS.set( i, this.checkmarks[i].checked );
            }
            
            for(i in this.drops)
            {
                RIL.APP.PREFS.set( i, this.drops[i].selectedItem.value );
            }
            
            for(i in this.texts)
            {
                RIL.APP.PREFS.set( i, this.texts[i].value );
            }
	    
	    
	    // Save keyboard shortcuts
	    let listitems = RIL.xul('keyboardShortcuts').getElementsByTagName('listitem');
	    let id, keySet, value;
	    for(let i in listitems) {
		if (listitems[i].id) {
		    id = listitems[i].id.replace(RIL.XULnamespace + 'keyboardShortcut','');
		    value = listitems[i].value;
		    RIL.APP.PREFS.set('hotkey_'+id, value ? value : '', true);
		}
	    }
	    
	    RIL.APP.refreshListInAllOpenWindows();
	    RIL.APP.commandInAllOpenWindows('RIL', 'refreshToolbarCountStatus', null, true);
	    RIL.APP.commandInAllOpenWindows('RIL', 'checkPage', null, true);
            
            
            // Handle events on changes
            if (oldStoreSecurely != RIL.APP.PREFS.getBool('storeSecurely') && oldLogin)
                RIL.APP.saveLogin(oldLogin.username, oldLogin.password);
            
            
        } catch(e) {
            Components.utils.reportError(e);
            RIL.APP.PROMPT.alert(window, 'Pocket', "Oh no! There was an error saving your settings.\n\nYou can get help at readitlaterlist.com/support/\n\nError: "+e);
        }
        
	return true;
    },
    
    cancel : function()
    {
        return true;  
    },
    
    
    
    // -- Account -- //
    
    configureAccount : function()
    {
	try {
	    let login = RIL.APP.getLogin();
	    
	    // Reset
	    RIL.xul('optionsForSignedOut').hidden = 
	    RIL.xul('optionsForSignedIn').hidden = true;
	    
	    if (login && login.username)
	    {
		RIL.xul('options_username_label').label = 'Logged in as: ' + login.username;
		RIL.xul('optionsForSignedIn').hidden = false;
		RIL.xul('optionsForSignedOut').hidden = true;
	    }
	    else
	    {
		RIL.xul('optionsForSignedIn').hidden = true;
		RIL.xul('optionsForSignedOut').hidden = false;
	    }
	} catch(e) {
            Components.utils.reportError(e);
            RIL.APP.d(e);
	}
    },
    
    clearLocalData : function()
    {	
	let login = RIL.APP.getLogin();
            
	if (RIL.APP.PROMPT.confirm(window, 'Pocket', RIL.l('localEraseConfirm') + "\n\n" + RIL.l('noUndoable') + (login && login.username  ? " \n\n" + RIL.l('noEffectOnline') : '')))
	{
		RIL.APP.clearLocalData();
			    
	    // delete offline files
	    this.clearOfflineCache(true);	    
	}
    },
    
    logout : function()
    {
    	if (RIL.APP.PROMPT.confirm(window, 'Pocket', 'Are you sure you want to log out? Your data will be removed from this computer, but will still be available if you log back into your Pocket account.'))
		{
		RIL.APP.logout();
		RILoptions.configureAccount();
		}
    },
    
    
    
    // -- Offline -- //
    
    configureOffline : function()
    {
	try {
	    this.setCheck('autoOffline', 'autoOffline');
	    this.setCheck('offlineOptionDownloadWeb', 'getOfflineWeb');
	    this.setCheck('offlineOptionDownloadText', 'getOfflineText');
	    
	    RIL.xul('offlineOptionDownloadWeb').disabled =
	    RIL.xul('offlineOptionDownloadText').disabled = !RIL.APP.PREFS.getBool('autoOffline');
	    
	    RIL.xul('autoOffline').onclick = function()
	    {
		RIL.xul('offlineOptionDownloadWeb').disabled =
		RIL.xul('offlineOptionDownloadText').disabled = !this.checked;
	    }
	    
	    this.offlineStatusChanged();
	    
	} catch(e) {
            Components.utils.reportError(e);
	}
    },
    
    clearOfflineCache : function(force)
    {	
        if (force || RIL.APP.PROMPT.confirm(window, 'Pocket', RIL.l('clearCacheConfirm')))
        {
	    window.openDialog("chrome://isreaditlater/content/offlineAction.xul", "", "chrome,titlebar,toolbar,centerscreen,resizable", 'clearing');
        }
    },
    
    changeOfflineDirectory : function()
    {
        try {
            
        // Display folder picker
        let nsIFilePicker = Components.interfaces.nsIFilePicker;
        let fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
        fp.init(window, "Select a Folder", nsIFilePicker.modeGetFolder);
        fp.displayDirectory = RIL.APP.ASSETS.DIR_RIL;
        let response = fp.show();
        
        // New folder selected
        if (response == nsIFilePicker.returnOK)
        {
            let oldFolder = RIL.APP.ASSETS.DIR_RIL;
            let newFolder = fp.file;
            
            if (oldFolder.path != newFolder.path)
            {
		window.openDialog("chrome://isreaditlater/content/offlineAction.xul", "", "chrome,titlebar,toolbar,centerscreen,resizable", 'moving', newFolder);                
            }
            
        }
	} catch(e) {Components.utils.reportError(e);}
    },
    
    offlineStatusChanged : function()
    {
	RIL.xul('clearOffline').disabled = RIL.APP.OFFLINE.clearingOffline;
	//RIL.xul('moveOffline').disabled = RIL.APP.OFFLINE.movingOffline;	
    },
    
    
    // -- Apps -- //
    
    configureApps : function()
    {
	try {
	    this.setCheck('optionsGoogleReader', 'integrate-gr');
	} catch(e) {
            Components.utils.reportError(e);
	}
    },
    
    appsAction : function(c, m, v, s)
    {
        RIL.APP.SYNC.tk(c,m,v,s);  
    },
    
    
    // -- Keyboard -- //
    
    configureKeyboard : function()
    {
	try {
	    let listitems = RIL.xul('keyboardShortcuts').getElementsByTagName('listitem');
	    let id, keySet;
	    for(let i in listitems) {
		if (listitems[i].id) {
		    id = listitems[i].id.replace(RIL.XULnamespace + 'keyboardShortcut','');
		    keySet = RIL.APP.PREFS.get('hotkey_'+id).split('||');
		    listitems[i].value = RIL.APP.PREFS.get('hotkey_'+id);
		    RIL.xulId(listitems[i].id + '-v').setAttribute('label', keySet[0] + (keySet[1] ? ' + ' + keySet[1] : '' ) );	
		}
	    }
	    
	    // -- Get Keysets -- //		
	    for (var property in KeyEvent) {
		RILoptions.gVKNames[KeyEvent[property]] = property.replace("DOM_","");
	    }
	    RILoptions.gVKNames[8] = "VK_BACK";
	} catch(e) {
            Components.utils.reportError(e);
	}
	
    },
    
    selectKey : function(event, forceEnabled)
    {        
    	let value = forceEnabled ? forceEnabled : RIL.xul('keyboardShortcuts').selectedItem.value.length;
	RIL.xul("newKey").disabled = !value;
	RIL.xul("setKey").disabled = !value;
	RIL.xul("disableKey").disabled = false;
	RIL.xul("disableKey").label = value ? RIL.l('disable') : RIL.l('enable');
	RIL.xul('newKey').value = '';
        
	if (value)
	    setTimeout(function(){RIL.xul('newKey').focus()},10);
    
    },
    
    keyDown : function(e)
    {
        RILoptions.keysDown.push(e.keyCode);
	e.preventDefault();
	e.stopPropagation();
        RIL.xul('newKey').value = '';
    },
    
    keyUp : function(e)
    {
        let i = RILoptions.keysDown.indexOf(e.keyCode);
        if (i >= 0)
            RILoptions.keysDown.splice(i,1);
	e.preventDefault();
	e.stopPropagation();
    },
    
    /*
     
     // on a mac these do not work with onkeypress:
     alt + X = Z
     alt + shift + X = shift + Z
     
     // these work:
     alt + control + X
     alt + shift + control + X     
     
     
     //LEFTOFF:
     http://www.quirksmode.org/js/keys.html
     
     keyCode and charCode are different for keyUp/keyDown/keyPress...
     
    */   
    
    detectKey : function(event) {
        try{
	event.preventDefault();
	event.stopPropagation();
        
        let keyCode = event.keyCode;
        let altKey = event.altKey;
        
        RIL.APP.d( event.charCode )
        RIL.APP.d( RIL.APP.ar(RILoptions.keysDown))
        
        // Mac alt workaround        
        if (navigator.userAgent.match('Macintosh') &&
            event.charCode > 150 &&
            !event.ctrlKey &&
            RILoptions.keysDown.length)
        {
            RIL.APP.d('hack');
            altKey = true; //force and assume
            
            // now figure out what the other key was
            // work backwards assuming the last key push will be at the bottom
            for(let i=RILoptions.keysDown.length-1; i>=0; i--)
            {
                keyCode = RILoptions.keysDown[i];
                
                // ignore modifer keys
                if (keyCode >= 16 && keyCode <= 18) continue;
                
                //else take the last key (now = keyCode)
                break;
            }
            RIL.APP.d('code ' + keyCode);
            
        }
        
	
	let modifiers = '';
	if (!RIL.xul('keyboardShortcuts').selectedItem.getAttribute('singleKey'))
	{
	    modifiers = [];
	    if(altKey) modifiers.push("alt");
	    if(event.ctrlKey) modifiers.push("control");
	    if(event.metaKey) modifiers.push("meta");
	    if(event.shiftKey) modifiers.push("shift");	    
	    modifiers = modifiers.join(" ");
	}
	
	let key = "";        
	if (keyCode)
	{
            if (keyCode >= 40 && keyCode <= 90)
                keyCode = String.fromCharCode(keyCode).toUpperCase();
            else 
                keyCode = RILoptions.gVKNames[keyCode];	 
	}
	else if(event.charCode)
	{
	    key = String.fromCharCode(event.charCode).toUpperCase();
	}
        if(!keyCode && !key) return;
	
	RILoptions.lastKeySet = (modifiers ? modifiers + '||' : '') + ((key)?(key):(keyCode));
	RIL.xul('newKey').value = RIL.formatKey( modifiers, key, keyCode );
        }catch(e){Components.utils.reportError(e);RIL.APP.d(e)}
    },
    
    setKey : function(event) {
	if (RILoptions.lastKeySet && RIL.xul('keyboardShortcuts').selectedItem) {
	    RIL.xul('keyboardShortcuts').selectedItem.value = RILoptions.lastKeySet;
	    RIL.xulId( RIL.xul('keyboardShortcuts').selectedItem.id ).value = RILoptions.lastKeySet	    
	    RIL.xulId( RIL.xul('keyboardShortcuts').selectedItem.id + '-v' ).setAttribute('label' , RIL.xul('newKey').value );
	}
    },
    
    disableKey : function(event) {
	if (RIL.xul('keyboardShortcuts').selectedItem) {
	    if (RIL.xul("disableKey").label == 'Enable')
	    {
		RILoptions.selectKey(null, true);
	    }
	    else
	    {
		RIL.xul('keyboardShortcuts').selectedItem.value = '';
		RIL.xulId( RIL.xul('keyboardShortcuts').selectedItem.id ).value = '';	    
		RIL.xulId( RIL.xul('keyboardShortcuts').selectedItem.id + '-v' ).setAttribute('label' , '' );
		RILoptions.selectKey();
	    }
	}
    },
    
    
    // -- Tweaks -- //
    
    configureAppearance : function()
    {
	try {
	    this.setDrop('optionsTextView', 'showStatusIconText');
	    this.setDrop('optionsShare', 'showStatusIconShare');
	    this.setDrop('optionsClick', 'showStatusIconClick');        
	    
	    this.setDrop('optionsListLayout', 'list-view');
	    this.setDrop('optionsList', 'list-place');
	    this.setDrop('optionsListFormat', 'list-type');
	    this.setText('optionsPerPage', 'list-page');
	    this.setCheck('optionsUnreadCount', 'show-count');
	    this.setCheck('optionsShowDate', 'show-date');
	    	                
	    RIL.xul('optionsPerPage').onchange = this.validatePerPage;	    
	    
	    this.togglePerPage();  
	    
	    
	} catch(e) {
            Components.utils.reportError(e);
	}
        
    },
    
    listSizeWarning : function()
    {
        if (RIL.xul('optionsListFormat').selectedItem.value == 'scroll' && RIL.APP.LIST.list.length > 300)
            RIL.APP.PROMPT.alert(window, 'Just a heads up...', 'The scrollable list has to load your entire list.  Due to the number of items in your list, it may load slower than using pages.');
    },
    
    togglePerPage : function()
    {        
        RIL.xul('optionsPerPage').disabled = !(RIL.xul('optionsListFormat').selectedItem.value == 'pages'); 
    },
    
    validatePerPage : function()
    {
	try{
	    let perPage = RIL.xul('optionsPerPage').value + '';	
	    if (!perPage.match(/^[0-9]{1,3}$/))
		RIL.xul('optionsPerPage').value = RIL.APP.PREFS.get('list-page');
	} catch(e){
	    Components.utils.reportError(e);
	}
    },    
    
    // -- Customize -- //
    
    configureTweaks : function()
    {
	try {

	    this.setDrop('optionsButton', 'read');
	    this.setDrop('optionsMarkAsRead', 'mark');
	    this.setDrop('optionsOpenIn', 'open');        
	    this.setCheck('optionsAutoMarkItems', 'autoMark');
            this.setCheck('optionsAutoClose', 'autoCloseTab');	 
	    this.setCheck('optionsAutoSync', 'autoSync');
            this.setCheck('optionsSecurePass', 'storeSecurely');            
	    
	    RIL.xul('optionsAutoMarkItems').onclick = this.toggleAutoMarkRelated;
            
	    this.toggleAutoMarkRelated();    	    
	    
	} catch(e) {
            Components.utils.reportError(e);
	}
        
    },   
    
    toggleAutoMarkRelated : function()
    {
        RIL.xul('optionsMarkAsRead').disabled = RIL.xul('optionsAutoMarkItems').checked;
	if (RIL.xul('optionsMarkAsRead').disabled)
	    RIL.xul('optionsMarkAsRead').selectedIndex = 3;
    },
    
    
    // -- Lovers
    
    loversAction : function(c, m, v, s)
    {
        RIL.APP.SYNC.tk(8,1,1,1);  
        if (c)
            RIL.APP.SYNC.tk(c,m,v,s);  
    },
    
    
    // -- Configure Debug -- //
    
    configureDebug : function()
    {
        if (RIL.APP.debug)
        {
            RIL.xul('options_menu_debug').hidden = false;
            RIL.xul('debug_box').value = RIL.APP.debugLog;
        }
    },
    
    
    // -- //
    
    setCheck : function(id, prefBoolId, checked)
    {
        let checkmark = RIL.xul(id);
        checkmark.checked = prefBoolId ? RIL.APP.PREFS.getBool(prefBoolId) : checked;
        if (prefBoolId)
            this.checkmarks[prefBoolId] = checkmark;
    },
    
    setDrop : function(id, prefId)
    {
        let drop = RIL.xul(id);
        let value = RIL.APP.PREFS.get(prefId);
        let items = drop.getElementsByTagName('menuitem');
        
        for(let i=0; i<items.length; i++)
        {
            if (items[i].value == value)
            {                
                drop.selectedItem = items[i];
                break;
            }   
        }
        
        if (prefId)
            this.drops[prefId] = drop;
    },
    
    setText : function(id, prefId)
    {
        let field = RIL.xul(id);
        field.value = RIL.APP.PREFS.get(prefId);
        
        if (prefId)
            this.texts[prefId] = field;
    }
    
}

RILoptions = new RILoptions();