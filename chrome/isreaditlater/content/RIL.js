/*
 
License: This source code may not be used in other applications whether they
be personal, commercial, free, or paid without written permission from Pocket.
 
 
/////////
DEVELOPER API: readitlaterlist.com/api/
/////////

If you would like to customize Pocket or build an application that works with
Pocket take a look at the Pocket OPEN API:
http://readitlaterlist.com/api/

Suggestions for additions to Pocket are VERY welcome.  A large number of user
suggestions have been implemented.  Please var me know of any additional features you
are seeking at: http://readitlaterlist.com/support/

Thanks
 
*/

function RIL()
{
    this.XULnamespace = 'RIL_';
    this.keyStates = [];
    this.netErrors = {};
    this.iconsToLoad = [];
    this.inited = false;
    
    this.clearMarkAsReadItemsFromListIn 	= 2.25 		* 1000;
    this.autoMarkTimerLength 			= 5 * 1000;
    
    this.markedRowClass = this.XULnamespace + 'marked_row';
    
    this.tagAutoCompleteKeyTO = false;
}
RIL.prototype = {
    
    init : function() {
	
	try { 
	    
            if (this.xul('toolbar_button'))
            {
                this.xul('toolbar_button').className += ' RIL_FF4';
             
                this.xul('toolbar_button').className += ' ' + (navigator.userAgent.match(/Firefox\/[3-9][0-9]/) ? 'RIL_FF30plus' : '');   
			}

            
	    if (this.inited) return;
	    
	    dump('\n\ninit RIL')
	    // get prefs service independent of the app in case .APP fails to load
	    this.PREFS = Components.classes['@ril.ideashower.com/rilprefs;1'].getService().wrappedJSObject;
            
	    // Connect to app
	    this.APP = Components.classes['@ril.ideashower.com/rildelegate;1'].getService().wrappedJSObject;
            
            // Setup debug
            this.APP.debug = this.PREFS.get('debug') * 1;

            //init app
	    if (!this.APP.inited){ this.APP.language = navigator.language; this.APP.init(); }

	    if (this.APP || this.APP.startupError)
	        this.addToToolbar();
	    
	    
	    // Events
	    if (this.xul('btnSync'))
		this.xul('btnSync').onclick = this.clickedSync;
	    
	    // Check where it's loading
                       
	    if (this.xul('login') ||
		this.xul('options') ||
		this.xul('clear'))
	    {
		// loaded in dialog
		
	    } else if (RILLOADEDINSIDEBAR) {
		
		// Loaded in sidebar
		this.inSidebar = true;
		
	    } else
	    {
		// Observers
		gBrowser.addProgressListener(this.urlBarListener);		
		
		
		// Setup XUL
		this.setupKeyStrokes();
		
		var defaultSortIndex = this.PREFS.get('default-sort');
		if (defaultSortIndex < this.xul('sort').itemCount)
		    this.xul('sort').selectedIndex = defaultSortIndex;
		
		// Update toolbar counter		
		this.refreshToolbarCountStatus();
		
		// Add Content Menus		
		this.xulId('context_bookmarkAllTabs', true).parentNode.insertBefore(this.xul('context_saveTabs', true), this.xulId('context_bookmarkAllTabs', true));
		
		// Context Menu Event
		this.xulId("contentAreaContextMenu", true).addEventListener("popupshowing", this.contextPopupShowing, false);
		
		
		// Page load event
		var appcontent = document.getElementById("appcontent");   // browser
		if(appcontent)
		      appcontent.addEventListener("DOMContentLoaded", this.onPageLoad, true);
                      
                //tc
		var tabviewdeck = document.getElementById("tab-view-deck");   // browser
		if(tabviewdeck)
		      tabviewdeck.addEventListener("DOMNodeInserted", this.tcLookForLoad, true);
                
                
                // Custom theme/platform icons
                /*if (navigator.userAgent.match(/Firefox\/3/))
                {
                   var skinsPrefs =  Components.classes["@mozilla.org/preferences-service;1"]
                                        .getService(Components.interfaces.nsIPrefService).getBranch("general.skins.");
                    var currentSkin = skinsPrefs.getCharPref('selectedSkin');
                    
                    if (currentSkin == 'classic/1.0' && this.xul('list'))
                    {
                        this.xulId('main-window').setAttribute('RIL_theme', navigator.userAgent.match('Macintosh') ? 'mac' : 'win');
                    }
                }
                
                // minefield
                else //if (navigator.userAgent.match(/b5pre/))
                //{*/
                    this.xul('toolbar_button').className += ' toolbarbutton-1';
                //}
                
                
                // Perform post install methods
                if (this.APP.openLoginWhenStarted)
                {
                    this.APP.openLoginWhenStarted = false;
                    this.APP.setTimeout(function(){
                        this.commandInMainWindow('RIL', 'openLogin');
                    }, 750);
                }
                        	
	    }
	    
	    // hide currently reading for new users (deprecated)
	    if (this.PREFS.getBool('startedWithPocket'))
	    {
	    	var lccr = this.xul('list_chooser_cr');
	    	if (lccr)
		    	lccr.parentNode.removeChild(lccr);
	    }
	    
            this.APP.d('finished init RIL');
            this.APP.d('list? ' + (this.APP.LIST?'t':'f'));
	    this.inited = true;          
	 	
	} catch(e)
	{
	    this.APP.d('ERROR');
	    // First try to display the error nicely
	    try
	    {
		this.genericMessage(this.l('couldNotStart')+":\n"+e,
				   [
				    {label:this.l('getHelp'), delegate:this, selector:'getHelp'}
				   ], false, false, true);
		
		
		// Hide all buttons
		this.startupError = true;
		
		// Log it
		Components.utils.reportError( this.l('couldNotStart') + "\n\n" + e );
		
	    } catch(err2) {
		    
		//Major failure, couldn't even display nice popups, so log it, var the user find it in the console
		Components.utils.reportError( this.l('couldNotStart') + "\n\n" + e + "\n\n" + err2 );
		    
	    }
	}
        
    },
    
    uninit : function() {	
	if (this.inMain)  {
	    gBrowser.removeProgressListener( this.urlBarListener );
	    appcontent.removeEventListener("DOMContentLoaded", this.onPageLoad, true);
	}
    },
    
    
    
    
    // -- Updating List
    
    
    refreshList : function(onlyIfType) { 
	if (onlyIfType && RIL.selectedListType && RIL.selectedListType != onlyIfType) return;
	if (RIL.listIsOpen())
	{
	    if (RIL.currentGenericIsPersisting) return;
            
	    RIL.refreshListStyle();
	    RIL.updateFilteredList();
	    RIL.populateList();
	}
	if (window.RILgr) RILgr.listWasRefreshed = true;
    },
    
    updateFilteredList : function() {        
	//custom handler
        if (this.selectedListType == 'read')
            return this.updateReadList();
        
	this.filterList();
	this.sortList();
    },
    
    updateReadList : function(force)
    {   
    	this.APP.d('RIL:updateReadList');
        var filter = this.getFilter();
        var sort = this.getSort();
        
        // Check cache
        if (force || !this.readList || this.readFilter != filter || this.readSort != sort || this.readPage != this.curPage || this.readListNeedsRefresh) 
        {
    		this.APP.d('RIL:updateReadList:call');
            this.readList = null;
            this.filteredList = null;
            this.readFilter = filter;
            this.readSort = sort;
            this.readPage = this.curPage;  
            this.APP.SYNC.gettingRead = false; // force it off (could be on if we went read->send->read)          
            this.APP.SYNC.getReadList(this.curPage, filter, sort ? sort-1 : null, this.getPerPage(), this, force);
        }
        else
        {
    		this.APP.d('RIL:updateReadList:stay');
            this.filteredList = this.readList.list;            
        }
        return true; //returning true stops from sort triggering
    },   
   
    observe: function(subject, topic, data)
    {        
        switch(topic)
        {
            case('ril-api-send-finished'):
                this.APP.unregisterObserver('ril-api-send-finished', this);
                this.updateReadList(true);
                break;
        }
    },
    
    readCallback : function(request)
    {        
    	this.APP.d('RIL:readCallback');
        this.readListNeedsRefresh = !request.success;
        this.syncingRead = false;
        this.readList = this.APP.SYNC.readCallback(request);
        this.filteredList = this.readList.list;
        this.refreshList();
    },
    
    setReadListNeedsRefresh : function()
    {
        this.APP.d('REFRESH')
        this.readListNeedsRefresh = true;  
    },
    
    getFilter : function()
    {
        var filterField = this.xul('filter');
        var filter = filterField.value;
	
	if (!filter || filter == filterField.emptyText)
	    filter = false; // do not filter, just return an unfiltered list;
            
        return filter;
    },
    
    getSort : function()
    {
        return this.xul('sort').selectedItem ? this.xul('sort').selectedItem.getAttribute('value') : null;
    },
    
    filterList : function()
    {
        // Read has custom handler
	if (this.selectedListType == 'read')
            return this.updateReadList();
        
	var filter = this.getFilter();
	
	this.filteredList = this.APP.filterList(this.selectedListType, filter, this);	
        this.filteredListIndexNeedsUpdate = true;    
	
	return filter;
    },
    
    sortList : function()
    {
        // Read has custom handler
	if (this.selectedListType == 'read')
            return this.updateReadList();
	
	// If the sort field is hidden, do not sort
	if (this.xul('sort').hidden) return;
	
        // Sort list
	var sortValue = this.getSort();	
	
	this.filteredList = this.APP.sortList(this.filteredList, sortValue);
        this.filteredListIndexNeedsUpdate = true;
        this.lastSort = sortValue;	
    },
    
    updateFilteredListIndex : function()
    {
        if (this.filteredListIndexNeedsUpdate || !this.filteredListIndex)
        {
            this.filteredListIndex = {};
            for(var i in this.filteredList)
            {
                this.filteredListIndex[this.filteredList[i].itemId] = i;
            }
        }
    },
    
    // -- Displaying List -- //
    
    toggleReadingList : function() {
	if ( RIL.justClosed ) { return false; }
	( !this.listIsOpen(true) ? this.openReadingList(): this.closeReadingList());	
    },
    
    listIsOpen : function(skipSidebarCheck)
    {
        if (!this.APP || !this.APP.inited) return false;
        
	if ( this.xul('list') && ( !(this.xul('list').state=='closed' || this.xul('list').state=='hiding') ) )
	    return 'window';
	
	if (!skipSidebarCheck && (this.xulId('sidebar', true) && this.xulId('sidebar', true).contentWindow.location.href == "chrome://isreaditlater/content/list.xul") )
	    return 'sidebar';
	
	return false;
    },
    
    // If the sidebar is open we need to send events there (not the active window)
    // If the dropdown is showing, end events there over the sidebar
    getPriorityRIL : function()
    {
	if (this.listIsOpen() == 'sidebar')
        {
	    return this.xulId('sidebar', true).contentWindow.RIL;
        }
	else
        {
	    return this;        
        }
    },
    
    openListAfterLogin : function()
    {
	// make sure noautohide is fixed if it was disabled by a dialog window
	setTimeout(function()
        {
	    RIL.APP.openUrl(RIL.APP.installedUrl, {targ:'tab',ig:true});
	    RIL.openReadingList(true);
	    
	    if(RIL.APP.SYNC.syncingEnabled() && RIL.APP.PREFS.getBool('autoSync'))
		RIL.APP.SYNC.sync(true);
	}, 150)	
    },
    
    openReadingList : function(forceOpen, delayedOpen) {
	
		if (!this.APP.showLoginPromptIfNeeded()) return;
	
	if (!this.listIsOpen(true) && this.PREFS.get('list-place') == 'btn') {
	    
	    this.xul('list').openPopup( this.xul('toolbar_button', true) ? this.xul('toolbar_button', true) : this.xulId('urlbar-container', true) , "after_end", -1, 3);
	
	} else if (this.xulId('sidebar', true) && !RILsidebar
                   /* &&
		   this.xulId('sidebar', true).contentWindow.location.href != "chrome://isreaditlater/content/list.xul"*/)
	{
	    
	    toggleSidebar('RIL_sidebarlist', forceOpen);
	    if ( RIL.getSidebarWidth() < 285) { RIL.setSidebarWidth(285) }
            return;
	}
	
	
	if (this.currentGenericIsPersisting) return;
	
	this.refreshListStyle();
	this.updateFilteredList();
	this.populateList();
	
	if (!this.hasShownListOnce)
	{
		this.refreshListType();
		this.hasShownListOnce = true;
	}
	
	// --- Detecting Ctrl/Shift/Command Click on Mac --- //
	if (navigator.platform != 'Win32') {
	    window.addEventListener("keydown", RIL.keyDown, false);
	    window.addEventListener("keyup", RIL.keyUp, false);
	    RIL.keyStates = [];
	}
	
	
	// Auto syncing
	if (RIL.APP.syncWhenListIsOpened)
	{
	    RIL.APP.syncWhenListIsOpened = false;
	    if (RIL.APP.PREFS.getBool('autoSync'))
	    {
		RIL.SYNC.syncInBackgroundTillResults = true;
		RIL.SYNC.sync();
	    }
	}
	
    },
	
    closeReadingList : function()
    {
	if (RIL.xul('list').hidePopup) {
	    RIL.xul('list').hidePopup();
	}
	if (navigator.platform != 'Win32') {
	    window.removeEventListener("keydown", this.keyDown, false);
	    window.removeEventListener("keyup", this.keyUp, false);
        }
    },
    
    listClosing : function()
    {
	RIL.xul('tagAutoComplete').hidePopup();
	if (RIL.messageExpiresWhenClosed || RIL.currentListClass)
	    RIL.clearListClass(true);
    },
    
    refreshListStyle : function()
    {
	if (this.currentGenericIsPersisting) return;
	this.xul('list').className = '';
	this.xul('list').className += this.getListType() == 'scroll' ? ' RIL_scroll' : '';	
	this.xul('listFooter').hidden = (this.getListType() == 'scroll');
    },
    
    getListType : function()
    {
        return this.selectedListType == 'read' ? 'pages' : this.PREFS.get('list-type');
    },
    
    populateList : function() {
	
        // Check for major errors
        if (this.APP.listError)
        {
            this.APP.genericMessage(this.l('problemLoadingList') + " \n\n " + this.l('errorConsole'),
                                   [
                                    {label:this.l('getHelp'), delegate:this.APP.getTopRIL(), selector:'getHelp'}
                                   ], false, false, true);
            return;
        }
        
        
	// Display the list or a message?
	if (this.APP.SYNC.syncing && !this.APP.SYNC.syncInBackgroundTillResults) {
	    this.message( this.l('Syncing') + '...' );
	    this.addClass( this.xul('list_inner'), 'RIL_loading' );
	    return;
	} else if (this.syncingRead) {
	    this.message( this.l('GettingRead') + '...' );
	    this.addClass( this.xul('list_inner'), 'RIL_loading' );
	    return;
	} else if (this.APP.LIST.fetching) {
	    this.message( this.l('Loading') + '...' );
	    this.addClass( this.xul('list_inner'), 'RIL_loading' );
	    return;
	} else {
	    this.removeClass( this.xul('list_inner'), 'RIL_loading' );	    	    
	}
	
	
	// Test if sidebar is loading correctly? - was giving errors that this method was not defined when loaded in a small popup	
	if (!this.xul('listPage').removeAllItems) return;
	
	
	// Hide editor if displayed
	this.hideEditors();
	
	
	// Special Errors
	if (RIL.selectedListType == 'read' && !RIL.APP.getLogin())
	{
	    RIL.genericMessage(RIL.l('accountForArchive') + "\n" + RIL.l('accountForArchive2'),
		[{label:RIL.l('signup'),delegate:RIL,selector:'openLogin'},
		 {label:RIL.l('login'),delegate:RIL,selector:'openLogin'} ]
	    );
	    return;
	}  
	
	
	
        if (!this.filteredList) this.updateFilteredList();
	
	// Clear list
	this.clearChildren( RIL.xul('list_rows'), this.XULnamespace + 'row' );
	
	// Output special list
	if (this.selectedListType == 'tags')
	{
	    this.populateTagList();
	}
	
	if (this.selectedListType != 'tags' || this.selectedTag)
	{	
	    // Output list
	    var row, perPage, start, end;
	    if (this.getListType()=='pages')
	    {
                this.updatePageCounter();
                if (this.selectedListType == 'read')
                {
                    start = 0;
                    end = this.readList && this.readList.list ? this.readList.list.length : 0;
                }
                else
                {                    
                    perPage = this.getPerPage();
                    start = (this.curPage-1) * perPage;
                    end = start + perPage * 1;
                }
	    }
	    else
	    {
		start = 0;
		end = this.filteredList.length;
	    }
	    
	    
	    // Empty list?
	    if (!this.filteredList || this.filteredList.length == 0)
	    {
		var msg = '';
                
		if (RIL.APP.LIST.list.length == 0)
		    msg = RIL.l('noItemsInList');
                    
		else if (RIL.xul('filter').value.length > 0 && RIL.xul('filter').value != RIL.xul('filter').emptytext)
		    msg = RIL.l('noItemsMatchFilter');
                    
		else if (RIL.selectedListType == 'current')
		    msg = RIL.l('noOpenItems');
                    
		else if (RIL.selectedListType == 'read')
		    msg = RIL.l('noArchivedItems');
                    
		RIL.genericMessage(msg, false, false, false, false, true);
		RIL.refreshListType();
	    }
	    
	    for(var i in this.filteredList) {	    
		if (i < start || i >= end) continue;
		
		row = this.rowForItem( this.filteredList[i], i - start );
		
		this.xul('list_rows').appendChild(row);		
	    }
	    
	    this.updatePageCounter();
	    
	}
	
	this.updateLoadMore();
	
	// If the history observer was added (for favicon loading detection), set it to be removed soon
	if (RIL.APP.historyObserverAdded)
	{
	    clearTimeout(RIL.APP.removeHistoryObserverTO)
	    RIL.APP.removeHistoryObserverTO = setTimeout(RIL.APP.genericClosure(RIL.APP, 'removeHistoryObserver'), 60000);
	}
        
    },  
	
    updatePageCounter : function() {
	this.updatePageCounterStats();
	this.fillSelect( this.xul('listPage'), 1, this.totalPages, this.curPage);
	
	this.xul('listPrevious').className = this.curPage == 1 ? 'RIL_dim' : 'text-link';	
	this.xul('listNext').className = (this.totalPages == 0 || this.curPage == this.totalPages) ? 'RIL_dim' : 'text-link';
    },
	
    updatePageCounterStats : function()
    {
        if (this.selectedListType == 'read')
        {
            this.totalPages = Math.ceil(this.readList.total/this.getPerPage());
        }
        else
        {
            this.totalPages = Math.ceil(this.filteredList.length/this.getPerPage());
        }
        if (!this.curPage) this.curPage = 1;
        this.curPage = this.curPage < this.totalPages ? this.curPage : this.totalPages;
        this.curPage = this.curPage > 0 ? this.curPage : 1;
        return this.curPage;
    },
    
    getPerPage : function()
    {
	var perPage = this.PREFS.get('list-page');
	if (!perPage.match(/^[0-9]{1,3}$/))
	    perPage = 9;
        this.perPage = perPage;
	return perPage;
    },
    
    updateLoadMore : function() { return;
    /*
	if (this.selectedListType == 'read') {
	    this.xul('listLoadMore').style.display = this.APP.SYNC.noMoreReadItems ? 'none' : 'block';
	    this.xul('listLoadMore').label = this.APP.SYNC.syncingRead ? '' : this.l('LoadMore');
	    this.xul('listLoadMore').image = this.APP.SYNC.syncingRead ? 'chrome://isreaditlater/skin/Throbber-small.gif' : '';
	    this.xul('listLoadMore').disabled = this.APP.SYNC.syncingRead;
	}
	else
	{
	    this.xul('listLoadMore').style.display = 'none';
	}*/
    },
    
    rowForItem : function(item, rowNumber) {
	
        if (!item) return;
        
	var rowClass, row, favIcon, favIconWrapper, wrapper, subWrapper, spacer, title, titleWraper, titleAnchor, accessory, domain, options;
	var text, edit, mark;
	var item, nsURI, host, titleStr, iconUrl, days;

	nsURI = this.APP.uri(item.url);
	if (!nsURI || !nsURI.host) return null;
	host = nsURI.host.replace('www.','');
	
        var compact = this.PREFS.get('list-view') == 'cond';
        
	//
	rowClass = this.XULnamespace + 'row ' + (compact ? this.XULnamespace + 'compact' : '');
	
	// Row
	row = RIL.createNode('row',
	{
	    id	: this.XULnamespace + 'item_' + item.itemId,
	    itemId 	: item.itemId,
	    url		: item.url,
	    class	: rowClass
	} );
        row.onmouseover = RIL.moveMenuToRow;
	 
	
	// Favicon wrapper	
	favIconWrapper = RIL.createNode('vbox',
	{
	    class : RIL.XULnamespace + 'favIconWrapper'		
	} );
	
	
	// Favicon - lazy load icons past first page (only applies to scrollable list)
        if (rowNumber < RIL.perPage)
        {
            favIcon = RIL.favIconElement(item, nsURI);
        } else
        {
            RIL.iconsToLoad.push( {wrapper:favIconWrapper,item:item,uri:nsURI} );          
            setTimeout( RIL.loadNextFavIcon, 100 );
            favIcon = null;
        }
	
	
	// Content Wrapper	    
	wrapper = RIL.createNode('vbox',
	{
	    flex	: 1
	});
	
	
	// Title Wrapper	    
	titleWrapper = RIL.createNode('hbox');
	
	// Title
	titleStr = this.htmlDecode( item.title.length > 0 ? item.title : item.url );
	if (!compact && titleStr.length > 120) titleStr = titleStr.substr(0,120) + '...';
	
	title = RIL.createNode('label',
	{
	    flex: 1,
	    tooltiptext	:	item.title,
	    class	:	this.XULnamespace + 'item_title',
	    url		:	item.url,
	    context	:	this.XULnamespace + 'item_context'
	} );
	
        
        if (compact)
        {
            title.setAttribute('crop', 'end');
            title.setAttribute('value', titleStr);
            title.onmouseover = function(e) { RIL.showInStatusBar(null, this);    }
        }
        
        else
        {
            // The title is wrapped in a html:a tag because text-decoration does not apply to multiline descriptions at the moment
            titleAnchor = RIL.createNode('a',
            {
                class:this.XULnamespace + 'item_title_anchor',
                style:'font-size:12px;',
                url		:	item.url,
            }, true);
            
            RIL.wbrThisString(titleStr, titleAnchor);
            
            titleAnchor.onmouseover = function(e) { this.setAttribute('style', 'font-size:12px;text-decoration:underline'); RIL.showInStatusBar(null, this);    }
            titleAnchor.onmouseout = function() { this.setAttribute('style', 'font-size:12px;'); }
            
        }
        
        
	title.onclick 		= RIL.itemClicked;
    
    
	// Accessory
	accessory = RIL.createNode('label',
	{
	    class	:	this.XULnamespace + 'item_accessory'
	} );
	
	if (this.selectedListType == 'current') {
	    accessory.textContent = item.percent + '%';
	} else if (this.APP.PREFS.getBool('show-date'))
        {
            days = Math.round( (RIL.APP.now() - item.timeUpdated) / 60 / 60 / 24);
            if (days >= 0)
                accessory.textContent = days == 0 ? 'today ' : days + ' day' + (days == 1 ? '' : 's');
        } else
        {
	    accessory.hidden = true;
	}
	
	
	// Content Wrapper
        subWrapper = this.createNode('hbox', {class:this.XULnamespace+'subWrapper'});
        
        
            
        // Extras
        if (!compact)
        {    
            // Domain
            domain = this.createNode('label',
            {
                flex		:	1,
                crop		:	'end',
                value		:	host,
                class		:	this.XULnamespace + 'item_domain',
                url			:	'http://' + host,
                context		:	this.XULnamespace + 'item_context',
                onclick		:	"RIL.openUrl('"+host+"');RIL.closeReadingList();"
            } );
            domain.onclick 		= RIL.itemClicked;
            domain.onmouseover = this.showInStatusBar;
            
            
            // Spacer
            spacer = RIL.createNode('spacer', {flex:1});
        }
       
	row.appendChild( favIconWrapper );
        if (favIcon)
            favIconWrapper.appendChild( favIcon );
	row.appendChild( wrapper );
	
	wrapper.appendChild( titleWrapper );
	titleWrapper.appendChild( title );
	if (!compact) title.appendChild( titleAnchor );
	titleWrapper.appendChild( accessory );
	
	
        if (!compact)
        {
            wrapper.appendChild( subWrapper );
            
            subWrapper.appendChild( domain );
            subWrapper.appendChild( spacer );
	}
        
        else
        {
            titleWrapper.appendChild( subWrapper );           
        }
        
        
	return row;
	
    },
    
    favIconElement : function(item, nsURI)
    {
    	// check cache
    	if (!RIL.APP.fiCache)
   			RIL.APP.fiCache = {};
   			
		var iconUrl = RIL.APP.fiCache[item.itemId] ? RIL.APP.fiCache[item.itemId] : false;
		
		var goFetch = false;
		if (!iconUrl)
		{
	    	// Pick a random color to use for the icon
    	    var fi = Math.floor(Math.random() * (4 - 1 + 1)) + 1;
        	iconUrl = 'chrome://isreaditlater/skin/favicon_'+fi+'.png';
        	goFetch = true;
        }
        
        // Create the element
        var favIcon = RIL.createNode('image',
        {
            src	: iconUrl,
            height: 16,
            width: 16	
        } );
        
        // Go fetch the favicon (async)
        if (goFetch)
        {
	        var theItem = item;
	    	RIL.APP.ICO.getFaviconURLForPage(nsURI, function (uri) 
	    	{
	    		// Update cache	
	    		RIL.APP.fiCache[theItem.itemId] = uri ? uri.spec : iconUrl;
	    	
	    		var missing = !uri || uri.spec.match('defaultFavicon.png');
	    	
	       		if (missing)
	            	RIL.APP.fetchFavIconForItem(theItem, uri);	
	            else	
		    		RIL.APP.favIconUpdated(uri, theItem);
	    	});
	    }
        
        return favIcon;
    },
    
    loadNextFavIcon : function()
    {
        if (RIL.iconsToLoad.length)
        {
            var iconSet = RIL.iconsToLoad.shift();
            if (iconSet.wrapper && iconSet.item && iconSet.uri)
            {
                var favIcon = RIL.favIconElement(iconSet.item, iconSet.uri);
                iconSet.wrapper.appendChild(favIcon);
            }
        }
    },
    
    moveMenuToRow : function(e)
    {
        // ---Make menu if not already built
        if (!RIL.itemMenu)
	{
            RIL.itemMenu = {wrapper:RIL.createNode('hbox')};
            
            // Text
            text = RIL.createNode('label',
            {
                value		:	'',
                tooltiptext	:	'Text View',
                class		:	RIL.XULnamespace + 'i_text RIL_action'
            } );
            text.onclick = RIL.textItemClicked;
            
            // Edit
            edit = RIL.createNode('label',
            {
                value		:	'',
                tooltiptext	:	'Edit',
                class		:	RIL.XULnamespace + 'i_edit RIL_action'
            } );
            edit.onclick = RIL.editItem;
            
            // Mark as Read
            mark = RIL.createNode('label',
            {
                value		:	'',
                class		:	RIL.XULnamespace + 'i_x RIL_action'
            } );
            mark.onclick = RIL.markListItemAsRead;
        
            // add to menu
            RIL.itemMenu.text = text;
            RIL.itemMenu.edit = edit;
            RIL.itemMenu.mark = mark;
            
            RIL.itemMenu.wrapper.appendChild( text );
            RIL.itemMenu.wrapper.appendChild( edit );	    
            RIL.itemMenu.wrapper.appendChild( mark );   
        }
               
        // Determine icons and tooltips
        RIL.itemMenu.mark.setAttribute('tooltiptext',
                                       !this.className.match('marked_row')
                                       ?
                                       RIL.selectedListType == 'read' ? RIL.l('AddBackToList') : RIL.l('MarkAsRead')
                                       :
                                       RIL.selectedListType == 'read' ? RIL.l('MarkAsRead') : RIL.l('AddBackToList')
                                       );
       
        // Move into place
        this.getElementsByClassName(RIL.XULnamespace+'subWrapper')[0].appendChild(RIL.itemMenu.wrapper);
        
    },
    
    refreshRow : function(itemId) {
	var currentRow = this.xul('item_' + itemId);
	if (currentRow) {
	    var newRow = this.rowForItem( this.APP.LIST.itemById( itemId ) );
            if (newRow)
                this.xul('list_rows').replaceChild(newRow, currentRow);
	}
    },
    
    refreshTagRow : function(tags)
    {	
	this.APP.LIST.rebuildTagIndex();
	var oldRow = this.xul('tag_' + tags.oldTag);
	var currentRow = this.xul('tag_' + tags.newTag);
	var newRow = this.rowForTag( tags.newTag );
	
	if (currentRow)
	{
	    // new tag row already exists, which means tag was renamed to something we already have, so just refresh that row
	    this.xul('list_rows').replaceChild(newRow, currentRow);
	}
	else if (oldRow)
	{
	    // new tag row does not exist, so replace the old one with this new one
	    this.xul('list_rows').replaceChild(newRow, oldRow);
	}
	else {
	    this.refreshList();
	}
    },
    
    populateTagList : function()
    {	    
	// sort tags
	this.APP.LIST.rebuildTagIndex();
	
    
        if (this.APP.LIST.tags.length == 0)
        {
            RIL.genericMessage(RIL.l('noTaggedItems'), [
                        {label:RIL.l('learnTags'), delegate:this, selector:'getHelpWithTags'}
                       ], false, false, false, true);
            
            return; 
        }
        
        
	// display tags
	var i, row;
	for(i in this.APP.LIST.tags)
	{
	    if (this.selectedTag && this.APP.LIST.tags[i].tag != this.selectedTag) continue;
	    row = this.rowForTag( this.APP.LIST.tags[i].tag );	    
	    this.xul('list_rows').appendChild(row);
	}
	
    },
    
    rowForTag : function(tag)
    {
	
	var rowClass, row, favIcon, wrapper, subWrapper, spacer, title, titleAnchor, accessory, domain, options;
	var text, edit, mark;
	var item, nsURI, host, titleStr, iconUrl;
	
	var tagSet = this.APP.LIST.tagByTag(tag);
	
	//
	rowClass = this.XULnamespace+'row ' + this.XULnamespace+'tagRow';
	
	// Row
	row = this.createNode('row',
	{
	    id		: this.XULnamespace + 'tag_' + tagSet.tag,
	    tag 	: tagSet.tag,
	    class	: rowClass
	} );
	
	
	// Favicon wrapper	
	favIconWrapper = this.createNode('vbox',
	{
	    class : this.XULnamespace + 'favIconWrapper'		
	} );
	
	
	// Favicon
	favIcon = this.createNode('image',
	{
	    src	: this.selectedTag ? 'chrome://isreaditlater/skin/arrow_down.png' : 'chrome://isreaditlater/skin/arrow_right.png',
	    tag		:	tagSet.tag
	} );
	favIcon.onclick 	= this.tagClicked;
	    
	    
	
	// Content Wrapper	    
	wrapper = this.createNode('hbox',
	{
	    flex	: 1
	});
	
	tag = this.createNode('description',
	{
	    flex: 1,
	    tooltiptext	:	'View pages tagged with ' + tagSet.tag,
	    class	:	this.XULnamespace + 'tag_title',
	    tag		:	tagSet.tag
	} );
	
	// The title is wrapped in a html:a tag because text-decoration does not apply to multiline descriptions at the moment
	tagAnchor = this.createNode('a',
	{
	    class		:this.XULnamespace + 'item_title_anchor',
	    style		:'font-size:12px;',
	    tag			:	tagSet.tag
	}, true);
	tagAnchor.textContent = tagSet.tag;
	
	tag.onclick 	= this.tagClicked;
	tagAnchor.onmouseover = function(e) { this.setAttribute('style', 'font-size:12px;text-decoration:underline'); }
	tagAnchor.onmouseout = function() { this.setAttribute('style', 'font-size:12px;'); }
    
    
	// Accessory
	accessory = this.createNode('label',
	{
	    class	:	this.XULnamespace + 'item_accessory'
	} );
	accessory.textContent = '('+tagSet.n+')';
	
	
	// Content Wrapper	    
	subWrapper = this.createNode('hbox');
	
	
	// Text
	openAll = this.createNode('label',
	{
	    value		:	'',
	    tooltiptext		:       this.l('openAllInTabs'),
	    class		:	this.XULnamespace + 'i_openAll RIL_action',
	    tag			:	tagSet.tag
	} );
	openAll.onclick = this.openTagInTabs;
	
	// Edit
	edit = this.createNode('label',
	{
	    value		:	'',
	    tooltiptext		:	this.l('edit'),
	    class		:	this.XULnamespace + 'i_edit RIL_action',
	    tag			:	tagSet.tag
	} );
	edit.onclick = this.editTag;
	
	// Mark as Read
	remove = this.createNode('label',
	{
	    value		:	'',
	    tooltiptext		:	RIL.l('removeTag'),
	    class		:	this.XULnamespace + 'i_delete RIL_action',
	    tag			:	tagSet.tag
	} );
	remove.onclick = this.removeTag;

	
	row.appendChild( favIconWrapper );
	favIconWrapper.appendChild( favIcon );
	
	row.appendChild( wrapper );	

	wrapper.appendChild( tag );
	tag.appendChild( tagAnchor );
	wrapper.appendChild( accessory );
	
	
	wrapper.appendChild( subWrapper );
	
	subWrapper.appendChild( openAll );
	subWrapper.appendChild( edit );	    
	subWrapper.appendChild( remove );
	
	return row;
    
    },
    
    editTag : function(e) {
	try {
	var edit_row = RIL.xul('editTag_row');
	var tag = this.getAttribute('tag');
	var row = RIL.xul('tag_'+tag);
	
	// Check if another editing instance is open
	if (!edit_row.hidden && RIL.editingRow) {
	    RIL.saveTag();
	    
	    // Restore vis on current row
	    if (RIL.editingRow) {
		RIL.editingRow.hidden = false;		
	    }
	}
	
	// Toggle Visibility and move edit row into positions
	row.hidden = true;
	edit_row.hidden = false;
	row.parentNode.insertBefore(edit_row, row);
	
	// Fill fields
	RIL.xul('edit_tag').value = tag;	
	
	// Add event
	RIL.xul('edit_tag').onkeypress = RIL.checkEditTagForEnter;
	
	RIL.editingRow = row;
	RIL.editingRow.setAttribute('tag', tag);
	
	}catch(e){Components.utils.reportError(e);}
    },
    
    saveTag : function()
    {
	var oldTag = this.editingRow.getAttribute('tag');
	var newTag = RIL.xul('edit_tag').value;	
	
	// Title
	RIL.APP.LIST.renameTag(oldTag, newTag);
	
	// Update Display
	if (RIL.selectedTag == oldTag) RIL.selectedTag = newTag;
	
	//this.APP.refreshTagRowInAllOpenWindows({oldTag:oldTag, newTag:newTag});
	this.APP.refreshListInAllOpenWindows('tags');
	this.hideEditTagRow();	
    },
    
    checkEditTagForEnter : function(e)
    {
	if (e.which == 13)
	    RIL.saveTag();
    },
    
    hideEditTagRow : function() {	
	this.xul('edit_tag').value = '';
	this.xul('editTag_row').hidden = true;
	this.editingRow = false;
    },
    
    openTagInTabs : function(e)
    {
	RIL.APP.LIST.rebuildTagIndex();
	
	var tag = this.getAttribute('tag');
	var tagList = RIL.APP.LIST.tagItemIndex[tag];
	var i;
	
	if (tagList)
	{
	    var check = {};
	    if (tagList.length < 5 ||
		RIL.PREFS.getBool('no-openAllTags-prompt') ||
		RIL.APP.PROMPT.confirmCheck( RIL.inSidebar ? RILsidebar.w : window, "Pocket", "Are you sure you want to open all "+tagList.length+" items tagged '"+tag+"' into new tabs?", "Do not ask me again", check)
		)
	    {
		for(i in tagList)
		{
		    RIL.openUrl(tagList[i].url, {targ:'tab'});
		}
		if (check.value) RIL.PREFS.set('no-openAllTags-prompt', true);
	    }
	}
	
    },
    
    removeTag : function(e, tag)
    {
	var tag = tag ? tag : this.getAttribute('tag');
	var check = {};
	if (RIL.PREFS.getBool('no-removeTag-prompt') ||
	    RIL.APP.PROMPT.confirmCheck( RIL.inSidebar ? RILsidebar.w : window, "Pocket", "Are you sure you want to delete the tag '"+tag+"'?  This action is not undoable.", "Do not ask me again", check)
	    )
	{
	    RIL.APP.LIST.removeTag(tag);	    
	    if (check.value) RIL.PREFS.set('no-removeTag-prompt', true);
	    
	    if (RIL.selectedTag == tag) RIL.selectedTag = false;
	    RIL.APP.refreshListInAllOpenWindows();	
	}
    },
    
    tagClicked : function(e)
    {
	var tag = this.getAttribute('tag');
	if (RIL.selectedTag && RIL.selectedTag == tag)
	{
	    RIL.selectedTag = false;
	} else
	{
	    RIL.selectedTag = this.getAttribute('tag');
	}
	RIL.refreshList();
    },
    
    
    // -- Switching Lists -- //
    
    switchToList : function(type) {
    
    if (type == 'tile')
    {
		RIL.openUrl('http://getpocket.com/a/', {targ:'tab',ig:true});
        this.closeReadingList();
    	return;
    }
    
	// Flush changes to the list first
	this.clearMarkAsReadItems();
	
	// Hide popups	
	this.xul('tagAutoComplete').hidePopup();
    
	// Set new list type
	this.selectedListType = type;
	
	this.refreshListType();
	
    this.curPage = 1; //reset page counter
	this.clearListClass();
	this.refreshList();
	
	},
	
	refreshListType : function()
	{
	var type = this.selectedListType;
	var label, sortIsHidden, showLogo;
	switch(type){
	    
	    case('current'):
		label = RIL.l('currentlyReading');
		sortIsHidden = true;
		break;
	    
	    case('read'):
		label = RIL.l('readArchive');
		sortIsHidden = false;
		break;
	    
	    case('tags'):
		label = RIL.l('tags');
		sortIsHidden = true;
		break;
	    
	    default:
	    showLogo = true;
		this.selectedListType = 'list';
		//label = RIL.l('readingList'); // we use an image instead
		label = '';
		sortIsHidden = false;
		break;
	    
	}
	
	this.xul('list_inner').className = this.xul('list_inner').className.replace(/RIL_listType_[a-z]*/, '');
	this.addClass( this.xul('list_inner') , 'RIL_listType_' + type);
	
	this.xul('chooser').className = showLogo ? 'RIL_showLogo' : '';
	this.xul('chooser').value = label;
	this.xul('sort').hidden = sortIsHidden;

    },
    
    addListClass : function(cls, label)
    {
	RIL.clearListClass();
	RIL.currentListClass = RIL.XULnamespace + cls;
	    RIL.addClass( RIL.xul('list'), RIL.currentListClass);
	RIL.xul('chooser').className = '';
		if (label)
	    RIL.xul('chooser').value = label;
    },
    
    clearListClass : function(resetLabel)
    {
	RIL.currentGenericIsPersisting = false;
	if (RIL.currentListClass)
	    RIL.removeClass( RIL.xul('list'), RIL.currentListClass);
	if (resetLabel)
	    RIL.switchToList(RIL.selectedListType);
    },
    
    
    // -- List Functions and Events -- //
    
    filterUpdated : function() {
	clearInterval(this.filterUpdateTO);
	this.filterUpdateTO = setTimeout(function() {
	    RIL.curPage = 1;
	    RIL.clearListClass();
            RIL.filterList();
            //if (!RIL.filterList()) //  resort if not matching or if there is no filter, resort the list because we just grabbed a fresh slice of the LIST.list
		RIL.sortList();
	    RIL.populateList();
	}, 250);
    },
    
    sortUpdated : function() {
        this.curPage = 1;
	this.sortList();
	this.populateList();
	this.PREFS.set('default-sort', this.xul('sort').selectedIndex);
    },
	
    showInStatusBar : function(e, obj) {
	obj = obj ? obj : this;
        if (RIL.xulId('statusbar-display', true))
        {
            RIL.xulId('statusbar-display', true).label = obj.getAttribute('url');
            obj.addEventListener('mouseout', function() { RIL.xulId('statusbar-display', true).label = ''; }, true);
        }
        else if (RIL.xulId('urlbar', true))
        {
            RIL.xulId('urlbar', true).setOverLink(obj.getAttribute('url'));
        }
    },
    
    // --- //
    
    message : function(msg) {
	this.xul('listMessageText').value = msg;
	this.xul('listMessage').hidden = false;
    },
    
    genericMessage : function(msg, buttons, openWindow, chooserValue, persist, inPlaceOfList) {
		
	RIL.clearChildren(RIL.xul('genericMessage'));
	
	var parts = msg.split(/\n{1,}/g);
	var i, desc;
	for(i=0; i<parts.length; i++)
	{
	    desc = RIL.createNode('description')
	    desc.textContent = parts[i];
	    RIL.xul('genericMessage').appendChild(desc);
	}
		
	if (buttons)
	{
	    var btn;
	    var buttonWrapper = RIL.createNode('hbox');
	    RIL.xul('genericMessage').appendChild( buttonWrapper );
	    
	      		
		for(i=0; i<buttons.length; i++)
		{
			btn = RIL.createNode('button', {label:buttons[i].title?buttons[i].title:buttons[i].label});

				if (buttons[i].link)
					btn.onclick = RIL.APP.genericDataClosure(this.APP, 'openUrlAndCloseList', buttons[i].link);
				else if (buttons[i].cancel)
					btn.onclick = RIL.APP.genericClosure(this.APP.getTopRIL(), 'closeReadingList');
				else
					btn.onclick = RIL.APP.genericClosure(buttons[i].delegate, buttons[i].selector);
					
			buttonWrapper.appendChild(btn);
		}
	}
	
	RIL.addListClass( !inPlaceOfList ? 'genericMessageOverAll' : 'genericMessage', chooserValue);
	
	// make sure this is below addListClass
	RIL.currentGenericIsPersisting = persist;
	
	if (openWindow && !RIL.listIsOpen())
	    RIL.openReadingList();
	
	RIL.messageExpiresWhenClosed = persist == 2 ? true : !persist;
	
    },
    
    // --- //
    
    
    itemClicked : function(e, obj, item, url, orgUrl) {	
	var click = RIL.whatIsTheClickTarget(e, 'open');
	obj = obj ? obj : this;

	if (click.targ) {
	
		var urlToOpen = url ? url : item ? item.url : obj.getAttribute('url');
		var typ = orgUrl ? 'a' : 'w';
	
	    RIL.openUrl( urlToOpen , {targ:click.targ, orgUrl:orgUrl, typ:typ});
	    if (click.userSetting) {
                RIL.closeReadingList();
	    }
	}
    },
    
    textItemClicked : function(e)
    {
        // Get itemId
        var row = RIL.bubbleToTagName(this, 'row');
        var itemId = row.getAttribute('itemId');
        var item;
        
	// Needs to add item back into list if click is coming from read list.
	if (RIL.selectedListType == 'read')
	{
            item = RIL.readList.list[ RIL.readList.iByItem[ itemId ] ];
	    var listItem = RIL.APP.LIST.itemByUrl( item.url );
	    if (!listItem)
	    {
		RIL.addReadItem( item, itemId );		
	    }
	}
        else {            
            // Needs to add url and item id to self for the itemClicked function to read
            item = item ? item : RIL.APP.LIST.itemById( itemId );
        }   

	RIL.itemClicked(e, this, item, 'chrome://isreaditlater/content/loadText.html?url=' + item.url, item.url);
    },
    
    itemContextSetup : function() {
	var url = document.popupNode.getAttribute('url') ? document.popupNode.getAttribute('url') : document.popupNode.parentNode.getAttribute('url');
	RIL.xul('item_context').setAttribute('url', url);
	RIL.contextRow = RIL.bubbleToTagName(document.popupNode, 'row');
	RIL.xul('item_context_edit').hidden = (RIL.selectedListType == 'read');
	
	// Decide which label to show for x action
	if (!RIL.contextRow.className.match(RIL.markedRowClass) )
	{
	    var label = RIL.selectedListType == 'read' ? RIL.l('AddBackToList') : RIL.l('MarkAsRead');
	    RIL.xul('content_markAsRead').label = label;	    
	}
	else
	{
	    var label = RIL.selectedListType == 'read' ? RIL.l('MarkAsRead') : RIL.l('MarkAsUnread');	   
	    RIL.xul('content_markAsRead').label = label;
	} 
    },
	
    itemContextClick : function(obj, targ) {
	this.openUrl(RIL.xul('item_context').getAttribute('url'), {targ:targ});
	this.closeReadingList();
    },
	
    itemContextDelete : function(obj) {
	
	var itemId = RIL.contextRow.getAttribute('itemId');
	var check = {value:false};
	if (RIL.PREFS.getBool('no-delete-prompt') || RIL.APP.PROMPT.confirmCheck( RIL.inSidebar ? RILsidebar.w : window, "Pocket", "Are you sure you want to delete without archiving?", "Do not ask me again", check)) {	    	    
	    
            if (RIL.selectedListType == 'read')
            {
                var item = RIL.readList.list[ RIL.readList.iByItem[ itemId ] ];
                RIL.APP.SYNC.deleteRemote(item.url, false);
            }
                
            else
            {
                RIL.APP.LIST.mark(itemId, false, false, true);
            }
                
                
	    if (check.value) RIL.PREFS.set('no-delete-prompt', true);	
	}
	RIL.APP.refreshRowInAllOpenWindows(itemId);	
	
    },
    
    
    // -- Editing Items -- //
    
    editItem : function(e, context) {
	try {
	var edit_row = RIL.xul('edit_row');
	var row = context && RIL.contextRow ? RIL.contextRow : RIL.bubbleToTagName(this, 'row');
	var item = RIL.APP.LIST.itemById( row.getAttribute('itemId') );	
	
	// Check if another editing instance is open
	if (!edit_row.hidden && RIL.editingRow) {
	    RIL.saveEdit();
	    
	    // Restore vis on current row
	    if (RIL.editingRow) {
		RIL.editingRow.hidden = false;		
	    }
	}
	
	// Toggle Visibility and move edit row into positions
	row.hidden = true;
	edit_row.hidden = false;
	row.parentNode.insertBefore(edit_row, row);
	
	// Fill fields
	RIL.xul('edit_title').value = item.title ? item.title : '';	
	RIL.xul('edit_tags').value = item.tagList ? item.tagList : '';
	
	// Add event
	RIL.xul('edit_title').onkeypress = RIL.checkEditTitleForEnter;
	
	RIL.editingRow = row;
	
	}catch(e){Components.utils.reportError(e);}
    },
    
    saveEdit : function() {
	var itemId = this.editingRow.getAttribute('itemId');
	
	// Title
	RIL.APP.LIST.saveTitle(itemId, RIL.xul('edit_title').value);
	
	// Tags
	RIL.APP.LIST.saveTags(itemId, RIL.xul('edit_tags').value);
	
	// Update Display
	this.xul('tagAutoComplete').hidePopup();
	this.APP.refreshRowInAllOpenWindows(itemId);
	this.hideEditRow();

    },
    
    checkEditTitleForEnter : function(e)
    {
	if (e.which == 13)
	    RIL.saveEdit();
    },
    
    hideEditRow : function() {	
	this.xul('edit_title').value = '';
	this.xul('edit_tags').value = '';
	this.xul('edit_title').focus();
	this.xul('edit_row').hidden = true;
	this.editingRow = false;
    },
    
    hideEditors : function()
    {
	if (this.editingRow)
	{
	    this.hideEditRow();
	    this.hideEditTagRow();
	}
	
    },
    
    markListItemAsRead : function(e, context) {
	
	var row = context && RIL.contextRow ? RIL.contextRow : RIL.bubbleToTagName(this, 'row');
        var cls = ' ' + RIL.markedRowClass;
        var item;
        var itemId = row.getAttribute('itemId');
	
        if (RIL.selectedListType == 'read')
        {
            item = RIL.readList.list[ RIL.readList.iByItem[ itemId ] ];
        }
        else {
            item = RIL.APP.LIST.itemById( itemId );
        }
		
	if (!row) return;
	
	// If X, set row as marked	
	if (!row.className.match(cls) )
	{
	    if (!RIL.markedItems) RIL.markedItems = [];
	    
	    RIL.markedItems[ item.itemId ] = true;
	    row.className += cls;
	    
	}
	
	// If +, set row as normal, remove from mark queue
	else
	{

	    RIL.markedItems[ item.itemId ] = false;
	    row.className = row.className.replace(cls, '');
	    
	}	
	
	clearTimeout(RIL.clearMarkAsReadTO);
	RIL.clearMarkAsReadTO = setTimeout(RIL.APP.genericClosure(RIL,'clearMarkAsReadItems'), RIL.clearMarkAsReadItemsFromListIn);

    },
    
    clearMarkAsReadItems : function()
    {
	clearTimeout(RIL.clearMarkAsReadTO);
	
	// If context menu is open, wait until it is closed
        // If currently editing, wait until it is closed
	if (RIL.xul('item_context').state == 'open' || RIL.xul('item_context').state == 'showing' || RIL.editingRow) {
	    RIL.clearMarkAsReadTO = setTimeout(RIL.APP.genericClosure(RIL,'clearMarkAsReadItems'), RIL.clearMarkAsReadItemsFromListIn);
	    return;
	}
	
	
	var item, itemsModified;
	for(var itemId in this.markedItems) {
	    if (this.markedItems[itemId]) {
		
		if (RIL.selectedListType == 'read') {
		    
		    // add to list
                    item = RIL.readList.list[ RIL.readList.iByItem[ itemId ] ];
		    RIL.addReadItem(item, itemId, true);
		    
		} else {
		    RIL.APP.LIST.mark( itemId, true );		    
		}
		itemsModified = true;
		
	    }
	}
	
	this.markedItems = [];
	
	if (itemsModified) RIL.APP.LIST.endBatchAndRefresh();
    },
    
    pageMove : function(n) {
	if (!n)
	{	    
	    this.curPage = this.xul('listPage').selectedIndex + 1;
	}
	else
	{
	    this.curPage += n;
	    
	    // Bracketing
	    if (this.curPage < 1) { this.curPage = 1; }
	    if (this.curPage > this.totalpages) { this.curPage = this.totalpages; }
	}
	
	this.xul('listPage').selectedIndex = this.curPage-1;
        RIL.APP.d('curPage: '+ this.curPage);
        if (this.selectedListType == 'read')
            this.refreshList(); 
        else
            this.populateList();
    },
    
    
    // -- Tag Auto Complete -- //
    
    populateTagAutoComplete : function( listToUse )
    {       
	var content = RIL.xul('tagAutoCompleteContent');
	var i, c=0, tempWrapper;
                
        if (navigator.userAgent.match(/(Macintosh|Linux)/))
        {
            content.hidden = true;
            return;
        }
	
	RIL.APP.LIST.rebuildTagIndex();
	RIL.clearChildren( content );
	RIL.checkboxesForTags = {};
	
	var ac = (listToUse && listToUse.length > 0);
	var results = ac > 0 ? listToUse : RIL.APP.LIST.tags;
	
	// Top Tags
	if (!ac)
	{
	    tempWrapper = RIL.createNode('vbox', {class:RIL.XULnamespace+'topWrapper'});
	    
	    for(i in RIL.APP.LIST.topTags)
	    {
		tempWrapper.appendChild( RIL.getTagRow(RIL.APP.LIST.topTags[i].tag, true) );
		c++;
		if (c == RIL.APP.numberOfMostUsedTags) break;
	    }
	    
	    // If there are any top tags to show, display them and the header
	    if (c > 0)
	    {
		content.appendChild( RIL.getTagRowHeader('most used'+':') );
		content.appendChild( tempWrapper );
	    }
	}
	
	
	// All tags
	content.appendChild( RIL.getTagRowHeader( (listToUse ? 'suggestions' : 'all tags' ) +':') );
	
        var cnt = 0;
	for(i in results)
	{
	    content.appendChild( RIL.getTagRow(results[i].tag, false, ac) );
            cnt++;
	}
	
	// Clear highlight
	RIL.currentTagAutoCompleteRow = null;
	RIL.currentTagAutoCompleteHighlightIndex = null;
	
	// Clear enter run
	RIL.tagAutoCompleteEnterRunStarted = false;
	
	//
	RIL.currentTagAutoCompleting = ac;
	
	// If there are no tags to display, hide the popup
	if (!results || results.length == 0 || cnt == 0)
	{
	    content.hidden = true;
	}
        else
        {
            content.hidden = false;   
        }	
	
    },
    
    getTagRowHeader : function(label)
    {
	return this.createNode('label', {class:this.XULnamespace+'tagRowHeader',value:label});	
    },
    
    getTagRow : function(tag, top, ac)
    {
	var row, checkbox, label;
	row = this.createNode('hbox', {class:this.XULnamespace + 'tagRow ' + this.XULnamespace + 'top'});
	
	checkbox = this.createNode('checkbox', {
	    minheight:0,
	    maxheight:11,
	    minwidth:0,
	    isATopRow:top?1:0,
	    label:tag,
	    checked:(RIL.xul('edit_tags').value.match( new RegExp('(^|,)\\s*?'+RIL.APP.regexSafe(tag)+'\\s*?(,|$)', 'i') ) ? 'true' : 'false')
	});
	checkbox.onclick = this.tagCheckboxChanged;	
	
	if (!this.checkboxesForTags[tag])
	    this.checkboxesForTags[tag] = [];
	this.checkboxesForTags[tag].push(checkbox);
	
	row.appendChild(checkbox);	
	
	return row;	
    },
    
    tagCheckboxChanged : function(e)
    {
	RIL.tagCheckboxAction(this);	
    },
    
    tagCheckboxAction : function(checkbox, toggleWhenDone)
    {
	// NOTE: this.checked seems to be reversed, onclick is being called before the checkbox is changed
	var tag = checkbox.label;
	var tagRegExSafe = RIL.APP.regexSafe(tag);
	var field = RIL.xul('edit_tags');
	var cursorPosition = field.selectionStart;
	var i;
	
	// Does the tag exist in the field?  (Make sure to add slashes to prevent regex issues)
	var reg = new RegExp('(^|,)\\s*?'+tagRegExSafe+'\\s*?(,|$)', 'i');
	if (field.value.match( reg ))
	{
	    // Remove it
	    if (checkbox.checked) {
		field.value = field.value.replace( reg, '$1 ' );
		field.value = field.value.replace(/,\s*?$/,''); //trim comma from the end
	    
		cursorPosition = field.value.length; // move to end
	    }
	}
	else
	{
	    // Add it
	    if (!checkbox.checked)
	    {
		if (RIL.currentTagAutoCompleting)
		{
		    if (RIL.tagAutoCompleteEnterRunStarted)
		    {
			// Insert a comma and then append the word to the current cursor position
			var prefix = RIL.APP.trim(field.value.substr(0, field.selectionStart)).length ? ', ' : '';
			field.value =  field.value.substr(0, field.selectionStart) +
					prefix + tag +
					field.value.substr(field.selectionStart);
					
			cursorPosition = field.selectionStart + tag.length + prefix.length;
			
		    } else
		    {
			// Add it in place of cursor's word and move cursor to end of word
			var prefix = (RIL.currentTagAutoCompleteStart > 0 ? ' ' : '' );
			field.value =  field.value.substr(0, RIL.currentTagAutoCompleteStart) +
					prefix +
					tag + 
					field.value.substr(RIL.currentTagAutoCompleteStart + RIL.currentTagAutoCompleteLength);
					
			cursorPosition = RIL.currentTagAutoCompleteStart + tag.length + prefix.length;
		    }
		    
		} else
		{
		    // Add it to the end of the string and move cursor to end
		    field.value += (field.value.match(/\w/) ? ', ' : '') + tag;
		    cursorPosition = field.value.length;
		}
	    }
		
	}
	
	// Update top tag checkbox (and vice versa) (if it exists for this tag)
	for(i in RIL.checkboxesForTags[tag])
	{
	    if (RIL.checkboxesForTags[tag][i] != checkbox)
	    {
		RIL.checkboxesForTags[tag][i].checked = !checkbox.checked;
	    }
	}
	
	// Refocus the textbox
	field.focus();
	field.selectionStart = field.selectionEnd = cursorPosition;
	
	// Toggle the checkbox
	if (toggleWhenDone) checkbox.checked = !checkbox.checked;
    },
    
    tagAutoCompletePress : function(e)
    {
	clearTimeout(RIL.tagAutoCompleteKeyTO);
	RIL.tagAutoCompleteKeyTO = setTimeout(RIL.APP.genericDataClosure(RIL, 'tagAutoCompleteKey', e.which), 50);
    },
    
    tagAutoCompleteKey : function(key)
    {
	
	var field = RIL.xul('edit_tags');
	var updateList = true;
	
	
	// Actions based on key
	// others you might need: 188=comma, 37/39 = LR, 8 = backspace
	if (key == 13) // Enter
	{
	    if (RIL.currentTagAutoCompleteRow )
	    {
		var checkbox = RIL.currentTagAutoCompleteRow.getElementsByTagName('checkbox')[0];
				
		RIL.tagCheckboxAction( checkbox, true );
		
		if (checkbox.checked) 
		    RIL.tagAutoCompleteEnterRunStarted = true; // use this to append new tags checked after the first one instead of replacing
				
	    } else
	    {
		clearTimeout(RIL.tagAutoCompleteKeyTO);
		RIL.saveEdit();
		return;
	    }
	    updateList = false;
	}
	else if (key == 40 || key == 38) // Up/Down
	{
	    //move highlight row in list
	    
	    // get rows
	    var content = RIL.xul('tagAutoCompleteContent');
	    var rows = content.getElementsByTagName('hbox');
	    
	    // unselect previous row
	    if (RIL.currentTagAutoCompleteRow)
		RIL.removeClass(RIL.currentTagAutoCompleteRow, RIL.XULnamespace + 'highlighted');
	    
	    
	    // Update current selection
	    if (RIL.currentTagAutoCompleteHighlightIndex != null && RIL.currentTagAutoCompleteHighlightIndex >= 0)
	    {
		RIL.currentTagAutoCompleteHighlightIndex += key == 38 ? -1 : 1;	    
		RIL.currentTagAutoCompleteHighlightIndex = RIL.currentTagAutoCompleteHighlightIndex >= rows.length ? rows.length -1 : RIL.currentTagAutoCompleteHighlightIndex;
		RIL.currentTagAutoCompleteHighlightIndex = RIL.currentTagAutoCompleteHighlightIndex <= 0 ? 0 : RIL.currentTagAutoCompleteHighlightIndex;
	    } else {
		RIL.currentTagAutoCompleteHighlightIndex = 0;
	    }
	    
	    // highlight new row
	    RIL.currentTagAutoCompleteRow = rows[RIL.currentTagAutoCompleteHighlightIndex];
	    RIL.addClass(RIL.currentTagAutoCompleteRow, RIL.XULnamespace + 'highlighted');
	    
	    // scroll to row
	    // this is a little more involved because contentRow.offsetTop always returns 0, so we have to guess at
	    // it based on the height of the content area vs. number of rows
	    var rowHeight = content.scrollHeight / rows.length;
	    var scrollPadding = rowHeight * 3; //number of rows to buffer when scrolling
	    var viewableTop = content.clientHeight + content.scrollTop;
	    var positionOfRow = rowHeight * RIL.currentTagAutoCompleteHighlightIndex+1;
	    if (key == 40 && positionOfRow > viewableTop - scrollPadding)
	    {
		// needs to scroll down
		content.scrollTop = positionOfRow;
	    }
	    else if (key == 38 && positionOfRow - scrollPadding < content.scrollTop)
	    {
		content.scrollTop = positionOfRow;
	    }
	    
	    return; // no need to update search
	}
	
	// Determine which word the cursor is on (in between commas)
	var previousCommaPosition = field.value.lastIndexOf(',', field.selectionStart-1);
	var nextCommaPosition = field.value.indexOf(',', field.selectionStart);
	var start = previousCommaPosition != -1 ? previousCommaPosition+1 : 0;
	var length = nextCommaPosition != -1 ? nextCommaPosition - start : field.value.length - start;
	var word = RIL.APP.trimLeft(field.value.substr( start , length ));
	
	// Save indexes for word
	RIL.currentTagAutoCompleteStart = start;
	RIL.currentTagAutoCompleteLength = length;
	RIL.currentTagAutoCompleteWord = word;
	
	
	// Run search
	if (updateList)
	{
	    if ( RIL.APP.trim(word).length > 0 )
	    {
		RIL.updateTagAutoCompleteFilter(word);
		
		// Repopulate list
		RIL.populateTagAutoComplete( RIL.previousTagAutoCompleteResults );
	    } else
	    {
		RIL.populateTagAutoComplete(  );
	    }
	}
    },
    
    updateTagAutoCompleteFilter : function(word)
    {
	var results, i, set;
	
	if (RIL.previousTagAutoCompleteWordRegexSafe && word.match( new RegExp('^' + RIL.previousTagAutoCpreviousTagAutoCompleteWordRegexSafeompleteWord, 'i' ) ))
	{	    
	    // reuse previous results
	    results = RIL.previousTagAutoCompleteResults;    
	}
	else
	{
	    // Search list for tags
	    results = [];
	    for(i in RIL.APP.LIST.tags)
	    {
		set = RIL.APP.LIST.tags[i];
		if (set.tag.match( new RegExp('^' + RIL.APP.regexSafe(word), 'i') ))
		{
		    results.push( {tag:set.tag, n:set.n} );
		}
	    }
	}
	
	RIL.previousTagAutoCompleteResults = results;
	RIL.previousTagAutoCompleteWordRegexSafe = RIL.APP.regexSafe(word);
	
    },
    
    
    // -- Main Toolbar Button -- //
    
    readSomething : function()
    {
	if (!this.filteredList) this.updateFilteredList();
	

	// Open the reading list (if no items, there was a problem starting, or if that is the setting the user has)
	if (!this.filteredList ||
	    this.filteredList.length == 0 ||
	    this.PREFS.get('read') == 'list' ||
	    this.startupError)
	{	    
	    this.openReadingList();
	}
	else
	{
	    switch( this.PREFS.get('read') )
	    {
		
		case('next'):
		    this.readNextItemInList();
		    break;
		
		case('rand'):
		    this.readSomethingRandom();
		    break;
		
	    }
	}
	
    },
    
    readNextItemInList : function() {
	
	if (this.filteredList && this.filteredList.length > 0)
	{
            this.updateFilteredListIndex();
	    
            var i;
	    var currentItem = RIL.getItemForCurrentPage();
	    if (currentItem.item)
	    {
		// Current page is in the list, so let's move from here forward    
		
		i = this.filteredListIndex[ currentItem.item.itemId ];
		var nextItem = this.filteredList[i*1+1];
		
		if (nextItem) this.openUrl( nextItem.url );
		else this.openUrl( this.filteredList[0].url ); // first item		
                
	    }
            else {
                if (content.document.RIL_item)
                {
                    // Current page is no longer in list but was, so use previous index value (since the adjacent item will have moved down into it's spot)
                    i = content.document.RIL_item.oldFilteredIndex;
                }
                else
                {
                    // Current page is not in list, so open the first item in the list
                    i = 0;
                }
                
                // if list still hasn't been opened since removal, filteredList has not been updated, so update it if we
                // find that the old entry still exists in the list
                if (!RIL.APP.LIST.itemByUrl(this.filteredList[i].url))
                    this.updateFilteredList();
                
                this.openUrl( this.filteredList[i].url );
            }
        }
    },
	
    readSomethingRandom : function() {
	if (this.filteredList.length > 0)
	{
	    var i = Math.floor(Math.random() * this.filteredList.length);
	    this.openUrl( this.filteredList[i].url );
	}
    },
        
   


    // -- Logins -- //
    
    openLogin : function()
    {
		if (RIL.listIsOpen())
		    RIL.closeReadingList();
		RIL.APP.getMainWindow().openDialog("chrome://isreaditlater/content/login.xul", "", "chrome,titlebar,toolbar,centerscreen,resizable");
    },
    
    relogin : function()
    {
	RIL.APP.logout(true);
        RIL.closeReadingList()
        RIL.openLogin();
    },
    
    openToRSSFeed : function()
    {
		var login = this.APP.getLogin();
		RIL.APP.getMainWindow().open('http://getpocket.com/users/'+login.username+'/');
    },
    
    
    // -- //
    
    getHelp : function()
    {
		RIL.APP.getMainWindow().open('http://readitlaterlist.com/support/');
    },
    
    getHelpWithTags : function()
    {
        RIL.APP.getMainWindow().open('http://readitlaterlist.com/support/tags/');
    },
    
    
    // -- Options -- //
    
    openOptions : function(tab)
    {
	if (RIL.listIsOpen())
	    RIL.closeReadingList();
	RIL.APP.getMainWindow().openDialog("chrome://isreaditlater/content/options.xul", "", "chrome,titlebar,toolbar,centerscreen,resizable", tab);
    },
    
    
    // -- Sync -- //
    
    clickedSync : function(e)
    {
	if (e.button != 0)
	{       
	    e.stopPropagation();		    
	}
	else if (RIL.APP.SYNC.syncing && !RIL.APP.SYNC.syncInBackgroundTillResults)
        {
            // cancel the sync
            RIL.APP.SYNC.cancelSync();
        }
        else
	{
	    RIL.APP.SYNC.sync(false, true);
	}
    },
    
    
    onContextSync : function()
    {
        var syncing = (this.APP.SYNC.syncing && !this.APP.SYNC.syncInBackgroundTillResults);        
        RIL.xul('context_cancelSync').hidden = !syncing;
        RIL.xul('context_normalSync').hidden = 
        RIL.xul('context_fullSync').hidden = syncing;     
    },
    
    // -- Web Workers -- //
    
    getWebWorker : function(script)
    {
        return new Worker(script);
    },
    
    
    // -- Offline -- //  
    
    openOfflineWindow : function()
    {
	var xulRIL = this.getPriorityRIL();
	
	xulRIL.xul('offlineOptionDownloadWeb').checked = RIL.PREFS.getBool('getOfflineWeb');
	xulRIL.xul('offlineOptionDownloadText').checked = RIL.PREFS.getBool('getOfflineText');
	
	xulRIL.addListClass( 'offline', 'Go Offline' );
	
	if (RIL.APP.OFFLINE.clearingOffline)
	    xulRIL.offlineIsClearing();
	    
	else if (RIL.APP.OFFLINE.movingOffline)
	    xulRIL.offlineIsMoving();
	
	else if (RIL.APP.OFFLINE.downloading)
	    xulRIL.offlineIsDownloading();
	    
	
	if (!RIL.listIsOpen())
	    xulRIL.openReadingList();
    },
    
    addNewItemToDownload : function(item, skipDownloadViews)
    {
	if (RIL.PREFS.getBool('autoOffline') && item)
	{
	    var views = null;
	    if (skipDownloadViews)
	    {
		views = {web:RIL.PREFS.getBool('getOfflineWeb'), text:RIL.PREFS.getBool('getOfflineText')};
		if (skipDownloadViews.web && views.web) views.web = false;
		if (skipDownloadViews.text && views.text) views.text = false;
	    }
	   
	    RIL.APP.OFFLINE.addItemToQueue( item, views, true );
	}
    },
    
    offlineStart : function(xulRIL)
    {
	// launch process from main window window (not sidebar)
	var mainWindow = RIL.APP.getMainWindow();
	xulRIL = xulRIL ? xulRIL : RIL;
		       
	if (mainWindow != window)
	{
	    if (mainWindow.RIL)
		mainWindow.RIL.offlineStart(RIL);
	    return;
	}
	
	// Make sure at least something is checked
	if (!xulRIL.xul('offlineOptionDownloadWeb').checked &&
	    !xulRIL.xul('offlineOptionDownloadText').checked) {
	    
	    RIL.APP.PROMPT.alert(window, 'Pocket', xulRIL.l('offlineNeedsOneView'));
	    
	    return false;
	}
	
	// Save options
	RIL.PREFS.set('getOfflineWeb', xulRIL.xul('offlineOptionDownloadWeb').checked);	
	RIL.PREFS.set('getOfflineText', xulRIL.xul('offlineOptionDownloadText').checked);
	
	
	// Carry on	
	var status, message;
	var action;
	
	if (!navigator.onLine)
	{
	    message = xulRIL.l('mustBeOnlineToDownload')+"\n"+xulRIL.l('turnOffWorkOffline');
	    action = {label:xulRIL.l('tryAgain'), delegate:xulRIL, selector:'openOfflineWindow'};
	}
	else
	{    
	
	    status = RIL.APP.OFFLINE.start(true);
	    if (status == -2) // queue is empty
	    {		
		if (RIL.APP.LIST.list.length == 0)
		{
		    message = xulRIL.l('nothingToDownload')+"\n"+xulRIL.l('addPagesToYourList');
		} else {
		    xulRIL.offlineDone();
		    return false;
		}
		action = null;
		
	    } else {
		
		return xulRIL.offlineIsDownloading();
		
	    }
	    
	}
	
	xulRIL.genericMessage(message, [action]);
	    
    },
    
    updateDownloadProgress : function(na)
    {
	
	if (na[0] == -1) {
	    this.xul('offlineProgress').hidden = true;
	    return;
	}
	
        if (na[0] <= na[1])
	{
	    clearInterval( this.hideProgressTO ); // make sure it isn't hidden now that it's been updated
            if (this.xul('offlineProgress').hidden) this.xul('offlineProgress').hidden = false;            
            this.xul('offlineProgress').label = RIL.l('downloading') + ' '+na[0]+'/'+na[1];
	    this.xul('offlineProgress').onclick = RIL.offlineIsDownloading;
        }
	else
	{
            this.xul('offlineProgress').label = RIL.l('downloadingComplete');
	    this.xul('offlineProgress').onclick = RIL.offlineDone;
	    clearInterval( this.hideProgressTO );
            this.hideProgressTO = setTimeout( function(){		
		RIL.xul('offlineProgress').hidden=true;
	    }, 10000);
	    	    
	    xulRIL = RIL.getPriorityRIL();
	    if (xulRIL.listIsOpen() && xulRIL.currentListClass == xulRIL.XULnamespace + 'genericMessageOverAll')
		xulRIL.offlineDone();
        }
    },
    
    offlineDone : function()
    {
	var f   = 	RIL.APP.OFFLINE.counters.failed;
	var msg = 	RIL.l('hasBeenDownloaded') + "\n";
	if (f)
	    msg +=	f + ' page' + (f==1?' was':'s were') + " not downloaded because they could not be reached.\n";
	
	RIL.getPriorityRIL().genericMessage(msg, false, true, 'Go Offline', 2);
    },
    
    offlineCancel : function() {
	RIL.APP.OFFLINE.downloading = false;
	
	if (RIL.listIsOpen())
	    RIL.getPriorityRIL().openOfflineWindow();
	    
	RIL.APP.OFFLINE.cancel();
    },
    
    offlineIsDownloading : function()
    {	
	RIL.getPriorityRIL().genericMessage(RIL.l('beingDownloaded') + ".\n" + RIL.l('doSomethingElse'), 
	[{label:RIL.l('stopDownload'), delegate:RIL, selector:'offlineCancel'}]
	, true, RIL.l('goOffline'), 2);
    },  
    
    offlineIsClearing : function()
    {	
	this.getPriorityRIL().genericMessage(RIL.l('cacheBeingCleared'), 
	null, true, RIL.l('goOffline'));
    },  
    
    offlineIsMoving : function()
    {	
	this.getPriorityRIL().genericMessage(RIL.l('cacheBeingMoved'), 
	null, true, RIL.l('goOffline'));
    },  
       
       
    // -- //
       
       
    offlineNotification : function(appendMsg)
    {
	if (!this.findNotificationBox('offline')) this.offlineNotificationOff();
	
	var msg = RIL.l('pageNotOffline');
	RIL.currentOfflineNotification = this.offlineNotificationOn( msg + (appendMsg ? appendMsg : '') );
    },
    
    offlineNotificationOff : function()
    {
	RIL.removeNotificationBox();
	RIL.currentNotification = null;
    },
    
    offlineNotificationOn : function(msg)
    {
	var name	= RIL.XULnamespace + 'offline';
	var icon	= 'chrome://isreaditlater/skin/disconnect.png';
	buttons = [{
		    accessKey : '',
		    label:  RIL.l('moreInfo'),
		    popup: null,
		    callback: function(){content.document.location.href='chrome://isreaditlater/content/offline.html';}
		},{
		    accessKey : '',
		    label:  RIL.l('hide'),
		    popup: null,
		    callback: this.offlineNotificationOff
		}];
	
	return this.getNotificationBox(name, msg, icon, buttons);
    },
    
    //    
    
    netErrorNotification : function(appendMsg)
    {
	if (!this.findNotificationBox('offline')) this.netErrorNotificationOff();
	
	var msg = RIL.l('loadedOffline');
	RIL.currentOfflineNotification = this.netErrorNotificationOn( msg + (appendMsg ? appendMsg : '') );
    },
    
    netErrorNotificationOff : function()
    {
	RIL.removeNotificationBox();
	RIL.currentNotification = null;
    },
    
    netErrorNotificationOn : function(msg)
    {
	var name	= RIL.XULnamespace + 'offline';
	var icon	= 'chrome://isreaditlater/skin/disconnect.png';
	buttons = [{
		    accessKey : '',
		    label:  'Hide',
		    popup: null,
		    callback: this.netErrorNotificationOff
		}];
	
	return this.getNotificationBox(name, msg, icon, buttons);
    },
    
    
    // -- Location bar XUL -- //
    
    checkLoad : function(e) {
	if (e.originalTarget instanceof HTMLDocument) {
	    var doc = e.originalTarget;
	    if (e.originalTarget.defaultView.frameElement) {
		// The unload was being called from an iframe, ignore it
		return false;
	    }
	    RIL.checkPage();
	}
    },
    
    checkPage : function(document)
    {	
	var url = RIL.currentURL();
	var item;

	if (url != 'about:blank' && RIL.APP.listHasBeenLoadedOnce && (RIL.APP.checkIfValidUrl(url) || url.match(/^(file|chrome):/))) {	    

	    RIL.currentItem = RIL.getItemForCurrentPage();	    
	    item = RIL.currentItem.item;
	    
	    if (item)
	    {
		
		if ((!navigator.onLine || (document && document.netError)) && !RIL.currentItem.offline)
		{
		    if (item.offlineWeb)
		    {
			RIL.loadOfflineWebView( item.itemId );
		    }
		    else if (item.offlineText)
		    {
			RIL.openTextViewForUrl( item.url );			
		    }
		}
		
		// Mask url for offline files
		if (RIL.currentItem.type == -1 || RIL.currentItem.offline )
		{
		    RIL.xulId('urlbar').value = item.url;
		    
		    if (navigator.onLine && RIL.netErrors[ item.itemId ])
		    {
			RIL.netErrorNotification();
			RIL.netErrors[ item.itemId ] = false;
		    }
		}
		
		// start auto mark timer
		if (RIL.PREFS.getBool('autoMark') && (RIL.lastURL && item.url != RIL.lastURL))
		{
		    clearTimeout(RIL.autoMarkTimerTO);
		    RIL.autoMarkItemId = item.itemId;
		    RIL.autoMarkTimerTO = setTimeout(RIL.autoMark, RIL.autoMarkTimerLength);
		}
		
		
	    }
	    
	}

	RIL.updateLocationBarButtons( item ? 2 : 1 );
	
	return item;
    },
    
    checkDocument : function(document)
    {
	if (!document) return;
	var location = document.location;	
	
	if (location != 'about:blank') {
	    
	    RIL.currentItem = RIL.getItemForDocument(document);	    
	    var item = RIL.currentItem.item;
	    
	    if (item)
	    {
		
		if ((!navigator.onLine || (document && document.netError)) && !RIL.currentItem.offline)
		{	    
		 
		    if (item.offlineWeb == 1)
		    {
			RIL.loadOfflineWebView( item.itemId, document );
		    }
		    else if (item.offlineText == 1)
		    {
			RIL.openTextViewForUrl( item.url, null, document );			
		    }
		    else if (document && document.netError && document == content.document) // only show if the document is the same as the neterror doc?
		    {			
			RIL.offlineNotification( item.offlineWeb == -1 || item.offlineText == -1 ? RIL.l('unableToReachLastTime') : null );
		    }
		 
		}
		
		return item;
		
	    }
	}
	
    },
    
    onPageLoad : function(aEvent) {
	if (aEvent.originalTarget.nodeName == "#document") {
	    var doc = aEvent.originalTarget;
	    
            if (doc.defaultView.frameElement) return false;
	    if (!doc || !doc.location) return false;
	    
	    // Handle Redirections
	    if (doc.location.href.match(/chrome\:\/\/isreaditlater\/content\/loadText.html\?url=(.*)/))
	    {
		RIL.retrieveAndOpenTextForUrl(RegExp.$1, 'current', doc);
		return;
	    }
	    
	    // -- Handle Plugins
	    	    
	    // Google Reader
	    RILgr.check();
	       
	    
	    
	    var currentItem = RIL.getItemForUri( RIL.APP.uri(doc.location), doc );
	    var item = currentItem.item;
	    
	    if (item) {
		
		
		// Stop looking for a net error if the page loaded normally
		RIL.checkForNetError(doc);
	    
		// Text Error Page
		if (currentItem.type == -1)
		{		
		    
		    if (doc.body)
		    {
			var error = RIL.APP.errorPackages[item.itemId];
			doc.title = item.title;
			doc.getElementById('RIL_title').innerHTML = item.title;
			doc.getElementById('RIL_original').innerHTML = item.url;
			doc.getElementById('RIL_original').href = item.url;
			doc.getElementById('RIL_message').innerHTML = error.errorMessage;
		    }
		    
		    return;
		}
		
		// scroll to
		var scrollSet = item && RIL.currentItem && item.scroll ? item.scroll[ RIL.currentItem.type ] : null;
		if (scrollSet)
		{
		    
		    if (currentItem.type == 1 && doc && doc.getElementById('RIL_less'))
		    {
			
			// find first Element with attribute nodeIndex = i (make sure it's inside less or more based on view)
			var i, e, av, arrElements;
			var mode = scrollSet.section == 1 ? 'more' : 'less';
			arrElements = doc.getElementById('RIL_'+mode).getElementsByTagName('*');
			
			for(i=0; i<arrElements.length; i++){
			    av = arrElements[i].getAttribute('nodeIndex');
			    if (av && av == item.scroll[1].nodeIndex) {
				e = arrElements[i];
				break;
			    }
			}
			
			if (e)
			{
			    RIL.APP.d(mode);
			    doc.body.setAttribute('id', mode);
			    e.scrollIntoView(true);
			}
			
		    }
		    else if ( currentItem.type == 2 && item.scroll[2] )
		    {
			doc.defaultView.scrollTo( content.pageXOffset, item.scroll[2].nodeIndex );			
		    }
		}
		
		// watch scrolling
		RIL.startWatchingScrollingForItemId(item.itemId, doc);
		
		// offline view
		if (currentItem.offline)
		{
		    
		    // text view
		    if (currentItem.type == 1)
		    {
			// setup events
			if (doc.body)
			{
			    
			    // load saved text view settings
			    doc.body.setAttribute('o', RIL.PREFS.get('text-options'));
			    
			    var evt = doc.createEvent("Events");
			    evt.initEvent("settingsloaded", true, false);
			    doc.body.dispatchEvent(evt);
			    
			    doc.addEventListener('settingschanged', RIL.textSettingsChanged, false, true)
			}
		    }
		}
		
		
	    }
	    
	}
	
    },
    
    checkForNetError : function(doc) {
	if (!doc) return;
	
	if (doc.baseURI.match('about:neterror'))
	{
	    doc.netError = true;
	    var item = RIL.checkDocument(doc);
	    if (item)
	    {
		RIL.netErrors[item.itemId] = true;
	    }
	}
    },
    
    getItemForCurrentPage : function()
    {
	return RIL.getItemForUri(getBrowser().currentURI);
    },
    
    getItemForDocument : function(doc)
    {
	return RIL.getItemForUri(RIL.APP.uri(doc.location), doc);
    },
    
    getItemForUri : function(uri, document)
    {
	try {
	var item = false;
	var itemId;
	var type;
	var offline = false;
	document = document ? document : content.document
		
	if (uri.scheme == 'file')
	{
	    if ( decodeURI( uri.spec ).match( RIL.APP.ASSETS.PAGES_FOLDER_NAME ))
	    {
		
		// check against offline paths
		uri.spec.match( new RegExp('\\W'+RIL.APP.ASSETS.PAGES_FOLDER_NAME+'\\W(-?[0-9]*)\\W([a-z]*)\.') );
		itemId = RegExp.$1;
		type = RegExp.$2 == 'text' ? 1 : 2;

		// If the content document is branded with an item, make sure the item still exists in the list
		// before using it
		if (document && document.RIL_item)
		{
		    item = RIL.APP.LIST.itemByUrl( document.RIL_item.url );
		}
		else if (itemId)
		{
		    item = RIL.APP.LIST.itemById(itemId);
		}
		offline = true;
	    }
	    
	}
	else if (uri.scheme == 'chrome' && uri.spec.match(/chrome:\/\/isreaditlater\/content\/textError.html\?page\=(-?[0-9]*)/) && RIL.APP.errorPackages[RegExp.$1])
	{
	    // If the content document is branded with an item, make sure the item still exists in the list
	    // before using it
	     if (document && document.RIL_item)
	    {
		item = RIL.APP.LIST.itemByUrl( document.RIL_item.url );
	    }
	    else
	    {
		item = document.RIL_item ? document.RIL_item : RIL.APP.errorPackages[RegExp.$1].item;
	    }
	    type = -1;
	}
	else
	{
	    item = RIL.APP.LIST.itemByUrl( uri.spec );
	    type = 2;
        }
	return {item:item, type:type, offline:offline};
	} catch(e) { Components.utils.reportError(e); }
    },
    
    updateLocationBarButtons : function(t)
    {
        if (!RIL.xul('urlbar_add', true)) return;
        
	var l;
	var m1;
	var m2;
	
	if (RIL.APP.listHasBeenLoadedOnce && !RIL.APP.listError)
	{
	    switch(t) {
		case(1): 
		    l=false;
		    m1=true;
		    RIL.lastURL = RIL.currentURL();
		    break;
		case(2): 
		    l=true;
		    m1=false;
		    break;
		default:
		    l=true;
		    m1=true;
                    break;
	    }
	}
	else
	{
	    l = true;
	    m1 = true;
	}
	
	if (RIL.xul('urlbar_add', true)) 		{ RIL.xul('urlbar_add', true).hidden = l; }
	if (RIL.xul('urlbar_mark', true)) 		{ RIL.xul('urlbar_mark', true).hidden = m1; }
	
	this.updateStatusBarIcon('textStatusButton', 'showStatusIconText', m1);
	this.updateStatusBarIcon('shareStatusButton', 'showStatusIconShare', m1, true);
	this.updateStatusBarIcon('clickToSaveButton', 'showStatusIconClick', m1);
	
    },
    
    updateStatusBarIcon : function(id, pref, m1, persist)
    {
	var pref, hidden;
	if (RIL.xul(id, true))
	{
	    pref = RIL.PREFS.get(pref);
	    hidden = pref == 'show' ? false : ( pref == 'hide' ? true : (persist && content.document.wasItemOnce ? false : m1)  );
	    RIL.xul(id, true).hidden = hidden;
	}
    },
    
    // -- //
    
    addCurrent : function(skipDownloadViews) {
    
    if (!this.APP.showLoginPromptIfNeeded()) return;
    
	// Check if the document was branded because the url may be masked on offline pages
	var url;
	if (content.document.RIL_item)
	{
	    url = content.document.RIL_item.url;
	}
	else
	{
	    url = RIL.currentURL();
	}
	if (!RIL.APP.checkIfValidUrl( url, true )) return false;
	
	// Add it
	var itemId = RIL.APP.LIST.add( {url:url, title:RIL.currentTitle()} );
	
	// If the content document brand exists, update it's item id
	if (content.document.RIL_item)
	    content.document.RIL_item.itemId = itemId;
	
	RIL.checkPage();
	RIL.startWatchingScrollingForItemId(itemId, content.document, true);
	
	RIL.addNewItemToDownload(RIL.APP.LIST.itemById(itemId), skipDownloadViews);
	
	return itemId;
    },
    
    addedFromLocationBar : function()
    {
        if (RIL.PREFS.getBool('autoCloseTab') && gBrowser.browsers.length > 1)
	    gBrowser.removeCurrentTab();  
    },
    
    addReadItem : function(item, itemId, batch)
    {
	// remove from readList
	//RIL.readList.list[ RIL.readList.iByItemId[ itemId ] ] = false;
	RIL.APP.LIST.readListNeedsRefresh();
	
	item.timeUpdated = RIL.APP.now();
	RIL.APP.LIST.add(item, batch);
    },

    markCurrentAsRead : function() {
	try {
	    var currentItem = RIL.getItemForCurrentPage();
	    
	    try {
		// Post mark as read action:
		if (!RIL.PREFS.getBool('autoMark')) // actions not allowed when auto mark is enabled, otherwise it can chain them together to remove the entire list one by one
		{
		    var action = RIL.PREFS.get('mark');
		    if (action == 'next') RIL.readNextItemInList(true);
		    else if (action == 'rand') RIL.readSomethingRandom();
		    else if (action == 'close' && gBrowser.browsers.length > 1) gBrowser.removeCurrentTab();
		}
	    } catch(e) {Components.utils.reportError(e);}
	    
	    // brand the document with the item so we can re-add offline pages correctly
	    //if (currentItem.offline || currentItem.type == -1)
	    //{
                RIL.updateFilteredListIndex();
                currentItem.item.oldFilteredIndex = RIL.filteredListIndex[currentItem.item.itemId];
		content.document.RIL_item = currentItem.item;
	    //}
	    
	    // brand the document with a flag that it used to be an item
	    content.document.wasItemOnce = true;
	    
	    RIL.APP.LIST.mark( currentItem.item.itemId );
	    RIL.APP.commandInAllOpenWindows('RIL', 'checkPage', null, true);
	    
	} catch(e) {Components.utils.reportError(e);}	
    },
    
    autoMark : function()
    {
	var currentItem = RIL.getItemForCurrentPage();
	if (currentItem && currentItem.item && currentItem.item.itemId == RIL.autoMarkItemId)
	    RIL.markCurrentAsRead();
    },
    
    saveLink : function(url, title, tags)
    {
  		if (!this.APP.showLoginPromptIfNeeded()) return;
    
	// Last ditch attempts to find the url and/or title
	url 	=  url && gContextMenu 	? gContextMenu.linkURL ? gContextMenu.linkURL : (gContextMenu.link ? gContextMenu.link : url) : url;
	title 	= !title && gContextMenu 	? gContextMenu.linkText()	: title;
	
	var itemId = this.saveItem(url, title, tags);
	
	if (itemId)
	    this.APP.resolveLink(itemId, url, this.APP.resolveLinkCallback);
    },
    
    saveItem : function(url, title, tags)
    {	
  		if (!this.APP.showLoginPromptIfNeeded()) return;
  		
	// Clean up
	if (!title) title = '';
	if (!tags) tags = '';
	if (!this.APP.checkIfValidUrl(url)) return false;
	title = this.APP.trim(this.APP.stripTags(title));
	
	// Save the link immediately so the user sees it in their list, then launch a thread
	// to follow through and resolve it
	
	var itemId = this.APP.LIST.add({url:url, title:title});
	var savedItem;
	
	if (!itemId)
	    savedItem = this.APP.LIST.itemByUrl(url);    
	
	if (itemId || savedItem && tags)
	    this.APP.LIST.saveTags(savedItem ? savedItem.itemId : itemId, tags);
	
	this.addNewItemToDownload(this.APP.LIST.itemById(itemId));
	
	return itemId;
    },
    
    saveTabs : function() {
    
    if (!this.APP.showLoginPromptIfNeeded()) return;
    
	var num, i, b;
	num = gBrowser.browsers.length;
	for (i = 0; i < num; i++) {
	    b = gBrowser.getBrowserAtIndex(i);
	    RIL.APP.LIST.add( {url:b.currentURI.spec , title:b.contentTitle}, true );
	}
	RIL.APP.LIST.endBatchAndRefresh();
    },
    
    saveArrayOfTabs : function(tabs, options)
    {
        if (!options)
            options = {};
            
        if (!options.tags)
            options.tags = '';
                        
	if (!RIL.APP.LIST.pendingScrollPositions) RIL.APP.LIST.pendingScrollPositions = {};
            
        var position, itemId;
        for(var i=0; i<tabs.length; i++)
        {           
            // Save item
            itemId = RIL.saveItem(
                                  tabs[i].tab.linkedBrowser.currentURI.spec,
                                  tabs[i].tab.linkedBrowser.contentDocument.title,
                                  options.tags
                                 );
            
            if (itemId)
            {
                RIL.logScrollPositionWeb(
                                      itemId,
                                      tabs[i].tab.linkedBrowser.contentWindow,
                                      tabs[i].tab.linkedBrowser.contentDocument
                                      );                
            }
        }
        
        RIL.APP.LIST.flushScrollPositions();
    },
    
    
    // -- Scrolling -- //
    
    startWatchingScrollingForItemId : function(itemId, doc, saveCurrentNow) {
	doc.itemId = itemId;
	
	// watch scrolling
	if (!RIL.APP.LIST.pendingScrollPositions) RIL.APP.LIST.pendingScrollPositions = {};
	doc.addEventListener('scroll', RIL.scrolled, false);
	
	if (saveCurrentNow)
	    RIL.scrolled();
    },
    
    scrolled : function(e, immediateFlush) {	
	var w = content.window;
	var d = content.document;
	
	if (!RIL.currentItem || !RIL.currentItem.item) return;
	
	if (RIL.currentItem.type == 1)
	{
	    // text view scrolling
	    var windowWidth = w.innerWidth;
	    var windowHeight = w.innerHeight;
	    var high 	= d.elementFromPoint(windowWidth/2, 20);
	    var low 	= d.elementFromPoint(windowWidth/2, 20+25);
	    var iH 	= high.getAttribute('nodeIndex');
	    var iL 	= low.getAttribute('nodeIndex');
	    
	    var e, i;
	    if (iH && iH*1 > iL*1) {
		e = high;
		i = iH;
	    } else if (iL) {
		e = low;
		i = iL;	
	    }
	    
	    if (i)
	    {
		RIL.APP.LIST.pendingScrollPositions[RIL.currentItem.item.itemId +'-'+ 1] = {
		    itemId: RIL.currentItem.item.itemId,
		    view: 1,
		    section: d.body.id=='more' ? 1 : 0,
		    nodeIndex: i,
		    percent: Math.ceil( w.pageYOffset + w.innerHeight ) / d.body.scrollHeight * 100
		}
	    }

	}
	else
	{
	    // fallback scrolling
            RIL.logScrollPositionWeb(RIL.currentItem.item.itemId, w, d);
	}
	
	RIL.APP.clearTimeout(RIL.APP.LIST.pendingScrollPositionsTO);
	if (immediateFlush) RIL.APP.LIST.flushScrollPositions();
	else
	RIL.APP.LIST.pendingScrollPositionsTO = RIL.APP.setTimeout(RIL.APP.LIST.flushScrollPositions, RIL.APP.timeToWaitBeforeFlushingScrollPositions, RIL.APP.LIST);
    },
    
    logScrollPositionWeb : function(itemId, w, d)
    {        
        RIL.APP.LIST.pendingScrollPositions[itemId +'-'+ 2] = {
            itemId: itemId,
            view: 2,
            nodeIndex: w.pageYOffset,
            percent: Math.ceil( w.pageYOffset + w.innerHeight ) / d.body.scrollHeight * 100
        }
    },
    
    
    // -- Click to Save Mode -- //
    
    toggleClickToSaveMode : function()
    {	
	!this.findNotificationBox() ? this.clickToSaveOn() : this.clickToSaveOff();	
    },
    
    clickToSaveOn : function()
    {
	// Close click to save and then reopen if it's already open
	if (!this.findNotificationBox()) this.clickToSaveOff();
	
	//
	content.document.addEventListener("click", this.clickSaveCallback, false);		

	RIL.currentNotification = this.displayNotificationForClickMode();
    },
    
    clickToSaveOff : function()
    {
	RIL.removeNotificationBox();
	content.document.removeEventListener("click", RIL.clickSaveCallback, false);
	RIL.currentNotification = null;
    },
    
    displayNotificationForClickMode : function()
    {
	var msg 	= this.l('ClickModeNotify');
	var name	= 'ISRILclickmode';
	var icon	= 'chrome://isreaditlater/skin/clicksave.png';
	buttons = [{
		    accessKey : '',
		    label:  this.l('tags'),
		    popup: 'RIL_clickToSaveTagsPanel'
		},{
		    label:  this.l('TurnOff'),
		    popup: null,
		    callback: this.clickToSaveOff
		}];
	this.xul('clickToSaveTags').value = '';
	
	return this.getNotificationBox(name, msg, icon, buttons);
    },
    
    clickSaveCallback: function(e) {
	var targ, url, newNode, link, X, Y, title;
	
	// Determine which link was clicked
	if (gContextMenu) {
	    
	    link = RIL.bubbleToTagName(gContextMenu.target, 'A');
	    
	} else {
	    
	    if (!e) var e = window.event;
	    if (e.target) targ = e.target;
	    else if (e.srcElement) targ = e.srcElement;
	    link = RIL.bubbleToTagName(targ, 'A');
	    e.preventDefault();
	    
	}
	
	// If we found a link, save it
	if (link && (RIL.findNotificationBox() || gContextMenu) ) {
	
	    if (RIL.PREFS.get('link-checks') != 'no') {
		newNode = RIL.getClickSavedNode();
		
		if (e) {
		    X = e.pageX;
		    Y = e.pageY;
		} else {
		    coords = RIL.findPos(link);
		    X = coords[0];
		    Y = coords[1];
		}
		newNode.style.left = (X + 10)+"px";
		newNode.style.top = (Y - 15)+"px";	
	    }
	    
	    // Get the link anchor text
	    title = RIL.APP.stripTags(link.innerHTML);
	    if (title.length == 0) {
		if (link.firstChild) {
		    
		    //If it doesn't have content then it's probably an image link, so check the image for a title or alt label first
		    if (link.firstChild.title.length > 0) {
			title = link.firstChild.title;
		    } else if (link.firstChild.alt.length > 0) {
			title = link.firstChild.title;
		    }
		}
	    }
	    
	    RIL.saveLink(link.href, title, RIL.xul('clickToSaveTags').value);
	}
    },	
	
    getClickSavedNode : function() {
	
	if (!RIL.clickModeNodesCounter) RIL.clickModeNodesCounter = 0;
	
	var newNode = content.document.createElement('div');
	var id = 'readitlatersaved' + RIL.clickModeNodesCounter;
	
	newNode.setAttribute('id', id);
	newNode.setAttribute('style', 'width:24px;height:24px;position:absolute;font-size:10px;font-weight:bold;color:#000000;background:url(\'chrome://isreaditlater/skin/book24-windows.png\') no-repeat;z-index:100000');
	
	content.document.body.appendChild(newNode);
	
	//if (RIL.PREFS.get('link-checks') == 'hide') {
	    setTimeout(RIL.APP.genericDataClosure(RIL, 'removeClickSavedNode', id), 1500);
	//}
	
	RIL.clickModeNodesCounter++;
	
	return newNode;
    },
	
    removeClickSavedNode : function(id) {
	this.removeNode(content.document.getElementById(id));
    },
    
    setTagsForClickToSave : function(notification, desc)
    {
	this.currentNotification.label = this.l('ClickModeNotify');
	if (this.xul('clickToSaveTags').value.length > 0)
	    this.currentNotification.label += ' Items will be tagged with ' + this.xul('clickToSaveTags').value;
    },

    
    // --- Notification Box --- //
    
    getNotificationBox : function(name, msg, icon, buttons) {		
	var notificationBox = gBrowser.getNotificationBox();
	if (!notificationBox.getNotificationWithValue(name))
	    return notificationBox.appendNotification(msg, name, icon, notificationBox.PRIORITY_WARNING_MEDIUM, buttons);    
    },
    
    findNotificationBox : function(name) {
	var name = name ? name : 'ISRILclickmode';
	var notificationBox = gBrowser.getNotificationBox();
	if (notificationBox.getNotificationWithValue(name))
	    return notificationBox;
	
    },
    
    removeNotificationBox : function(name) {	
	var notificationBox = this.findNotificationBox();
	if (notificationBox)
	    notificationBox.removeCurrentNotification();
    },
	
    
    
    // -- Text -- //
    
    retrieveAndOpenTextForCurrentUrl : function(refresh)
    {
	var currentItem = RIL.getItemForCurrentPage();
	var item = currentItem.item;
	var url = item ? item.url : 'nonexist';
	
	RIL.retrieveAndOpenTextForUrl(url, 'current', content.document, refresh);	
    },
    
    retrieveAndOpenTextForUrl : function(url, target, doc, refresh, title)
    {
	var item = RIL.APP.LIST.itemByUrl( url );
	var itemId;
	
	if (target == 'current')
	{
	    var currentItem = RIL.getItemForCurrentPage();
	    
	    // if text view is currently open, ask if they'd like to refresh it
	    if ( (currentItem.type == 1 && currentItem.offline) || currentItem.type == -1)
	    {
		if (currentItem.item.url == url)
		{
		    if (RIL.APP.PROMPT.confirm(window, 'Pocket', RIL.l('redownloadText')))
		    {
			refresh = true;
			if (item)
			    url = item.url;
		    }
		    else { 
			return;
		    }
		}
	    }
	}
	
	// if item is not in the user's list, then add it before fetching

	if (!item)
	{
	    if (target == 'current')
		itemId = RIL.addCurrent( {text:true} );
	    else
		itemId = RIL.APP.LIST.add( {url:url, title:title} );
	    
	    // get item object
	    item = RIL.APP.LIST.itemById( itemId );
	    
	    if (!item) return; // failed to save page to list
	}
	
	
	// check if text has already been downloaded
	if (item.offlineText == 1 && (!refresh || !navigator.onLine ))
	{
	    RIL.openTextViewForUrl(url, target);
	}	
	
	// if not
	else {		    
	    
	    if (target != 'current')
	    {
		RIL.openUrl('chrome://isreaditlater/content/loadText.html?url='+url, {targ:target, orgUrl:url, typ:'a'});
		return;
	    }
	    
	    // a text view is already being loaded here, so cancel the request
	    if (content.document.getElementById('RIL_TEXT_SPINNER'))
	    {
		return false;
	    }
	    
	    // throw a spinner
	    var spinner = content.document.createElement('div');
	    spinner.style.position = 'fixed';
	    spinner.style.zIndex = '999999999';
	    spinner.style.left = '0px';
	    spinner.style.top = '0px';
	    spinner.style.width = '100%';
	    spinner.style.height = '100%';
	    spinner.style.opacity = '0.85';
	    spinner.style.background = '#FFFFFF url(chrome://isreaditlater/skin/syncing.png) center no-repeat';
	    spinner.setAttribute('id', 'RIL_TEXT_SPINNER');
	    content.document.body.appendChild(spinner)
	    
	    // fetch	    
	    RIL.APP.OFFLINE.downloadTextWrapper( item.itemId, item.url, RIL, doc );	    
	    
	}
	
    },
    
    textViewReady : function(downloader, doc)
    {	
	RIL.APP.LIST.updateOffline(downloader.itemId, downloader.type, downloader.statusCode);
	
	//if (!downloader.success)
	//{
	//    RIL.APP.PROMPT.alert(window, 'Pocket', "There was a problem getting the text view:\n\n"+downloader.textRequest.error);
	//    downloader.doc.location.reload();
	//} else {	
	    RIL.openTextViewForUrl( downloader.url, null, doc, null );
	//}
    },
    
    openTextViewForUrl : function(url, target, doc, error)
    {
	var target = target ? target : 'current';	
	var item = RIL.APP.LIST.itemByUrl(url);
	var path, linkpath;
		
	if (item.offlineText != 1)
	{
	    var errorMessage;
	    
	    if (error)
	    {
		// not really sure how it could ever get here, but probably a good catch just in case
		errorMessage = '<p>The text generator could not reach the original article.</p></p>'+error+'</p>';
	    } else if (item.offlineText == 0)
	    {
		// not really sure how it could ever get here, but probably a good catch just in case
		errorMessage = '<p>A text view has not been downloaded for this page.  Click the text icon in the status bar to download the text view</p>';
	    }
	    else if (item.offlineText == 403)
	    {
		errorMessage = '<p>The text generator could not reach the original article.</p>\
				<p>You may have been trying to download too many articles at once.  Please wait a little while before trying again.</p>\
				<p>Otherwise, if you continue you have problems, <a href="http://readitlaterlist.com/support/">please var me know</a>.  Thanks!</p>';
	    }
	    else if (!navigator.onLine)
	    {
		errorMessage = '<p>Pocket was not able to reach the original article the last time it tried to download this page.</p>\
				<p>Next time you are connected to the internet, double check that the page is still available online and try then again.</p>\
				<p>Otherwise, if you continue you have problems, <a href="http://readitlaterlist.com/support/">please var me know</a>.  Thanks!</p>'; 
	    }
	    else
	    {		
		errorMessage = '<p>The text generator could not reach the original article.</p>\
				<p>You can see if the site is down by viewing the article here: <a target="_blank" href="'+item.url+'">'+item.url+'</a></p>\
				<p>If you are able to view the original article, try generating the text again.</p>\
				<p>Otherwise, if you continue you have problems, <a href="http://readitlaterlist.com/support/">please var me know</a>.  Thanks!</p>';
	    }
	    
	    RIL.APP.errorPackages[item.itemId] = {
		errorMessage: errorMessage,
		item : item
	    }
	    
	    // Load error template - when loaded it will fire an event to fill the page
	    linkpath = path = 'chrome://isreaditlater/content/textError.html?page='+item.itemId;
	    
	}
	else
	{		    
	    linkpath = this.APP.ASSETS.folderPathForItemId( item.itemId, true ) + 'text.html';
	    path = this.APP.ASSETS.folderPathForItemId( item.itemId ) + 'text.html';	    
	}
	    
	if (doc)
	{
	    //if doc still has url loaded (and wasn't changed/closed)
	    doc.location.href = linkpath;
	}
	else
	{
	    this.openUrl(path , {targ:target});
	}
    },
    
    textSettingsChanged : function(e)
    {	
	// get the document
	var o = content.document.body.getAttribute('o');
	
	if (o)
	    RIL.PREFS.set('text-options', o);	
    },
    
    loadOfflineWebView : function(itemId, inDocument)
    {	
	var path = RIL.APP.ASSETS.folderPathForItemId( itemId , true ) + 'web.html';
	
	if (inDocument)
	    inDocument.location = path;    
	else
	    setTimeout(RIL.APP.genericDataClosure(RIL, 'openUrlO', {url:path}), 10);
    },
    
    
    
    
    // -- Navigation -- //
    
    openUrlO : function(o) {
    	this.openUrl(o.url, o);
    },
    
    openUrl : function(url, o) {
	    if (!o)
    		o = [];
    		
    	if (!o.ig)
    	{
    		var pkg = {
    			t : o.typ,
    			u : o.orgUrl?o.orgUrl:url,
    			time : new Date().getTime()
    		}
			this.APP.SYNC.addToSyncQueue('o', JSON.stringify(pkg), false, true);
    	}
    	
		o.targ = ((o.targ)?(o.targ):('current'));
		var w = this.inSidebar ? RILsidebar.w : PKTmainWindow;
		w.openUILinkIn(url, o.targ, null, null, o.ref?RIL.APP.uri(o.ref):null);
    },
    
    
    
    // --  Observers -- //
	    

    urlBarListener : {
	    QueryInterface: function(aIID) {
		    if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
		       aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
		       aIID.equals(Components.interfaces.nsISupports))
		    return this;
		    throw Components.results.NS_NOINTERFACE;
	    },
	    
	    onLocationChange: function(aProgress, aRequest, aURI) {
		RIL.checkPage(aURI);
	    },	
	    
	    onStateChange: function() {},	
	    onStatusChange: function() {},
	    onProgressChange: function() {},
	    onSecurityChange: function() {},
	    onLinkIconAvailable: function() {},
    },
    
    
    // -- Overall XUL Layout -- //
    
    
	
    addToToolbar : function() {

	// --- Add Buttons if not on UI --- //
	var id = this.XULnamespace + 'toolbar_button';
	if (!this.PREFS.getBool('toolbar-btn-added') && !this.xulId(id, true)) {
	    var navbar = this.xulId("nav-bar", true);
	    if (navbar)
	    {
		var curSet = navbar.currentSet;
		if (curSet.indexOf( id ) == -1) {
		    var set = curSet + "," + id;
		    navbar.setAttribute("currentset", set);
		    navbar.currentSet = set;
		    document.persist("nav-bar", "currentset");
		    BrowserToolboxCustomizeDone(true);
		}
		this.PREFS.set('toolbar-btn-added', true);
	    }
	}	
	    
    },
    
    refreshToolbarCountStatus : function()
    {
	if (RIL.PREFS.getBool('show-count'))
	{
	    RIL.updateUnreadCount();
	    RIL.addClass(RIL.xul('toolbar_button'), 'RIL_show_count');	    
	}
	else
	{
	    RIL.removeClass(RIL.xul('toolbar_button'), 'RIL_show_count');	    
	}
    },
    
    updateUnreadCount : function() {
	if (RIL.xul('toolbar_button') && RIL.APP.LIST.list)
	    RIL.xul('toolbar_button').setAttribute('unread', RIL.APP.LIST.list.length);
    },
    
    
    // -- Key set -- //
    
    setupKeyStrokes : function() {
	var keySet = this.xulId('mainKeyset', true);
	if (keySet && !this.xul('key_toggle', true)) {
	    
	    this.newKey(keySet, 'hotkey_toggle', "RIL.hotKeyToggle()" );
	    this.newKey(keySet, 'hotkey_push', "RIL.hotKeyPush()" );
	    this.newKey(keySet, 'hotkey_open_list', "RIL.hotKeyOpenList()" ) 
	    this.newKey(keySet, 'hotkey_click_mode', "RIL.hotKeyClickMode()" );
	    
	    //sidebar
	    var sKey = this.newKey(keySet, 'hotkey_sidebar', "toggleSidebar('RIL_sidebarlist');" );
	    if (sKey)
		sKey.command = 'RIL_sidebarlist';			
	    
	    //sidebar menu option
	    if ( this.xulId('viewSidebarMenu', true) ) {
		    this.xulId('viewSidebarMenu', true).appendChild( this.createNode('menuitem', {
			key:		this.XULnamespace + 'hotkey_sidebar',
			observes:	'RIL_sidebarlist'
		    } ) );				
	    }
	}
    },    
    
    formatKey : function(modifiers, key, keycode) {
	modifiers = ((modifiers)?(modifiers.split(' ').join(' + ') + ' + '):(''));
	return modifiers + ((key)?(key):(keycode));		
    },
	
    newKey : function(keySet, key, oncommand) {
	
	var currentKey = RIL.xul(key);
	if (currentKey) this.removeNode(currentKey);
	
	var keyPair;
	var pref = RIL.PREFS.get(key);
	if (pref && pref.length) {
	    keyPair = pref.split('||');
	    key = this.createNode('key', {
		id:this.XULnamespace + key,
		modifiers:keyPair[0],
		oncommand:oncommand
	    } );
	    key.setAttribute( ((keyPair[1].length > 1)?('keycode'):('key')) , keyPair[1]);
	    
	    keySet.appendChild(key);
	    
	    return key;
	}
    },
	
    hotKeyToggle : function() {
	var currentItem = RIL.getItemForCurrentPage();
	if (currentItem && currentItem.item)
	{
	    RIL.markCurrentAsRead();
	}
	else
	{
	    RIL.addCurrent();
            RIL.addedFromLocationBar();
	}
	RIL.checkPage();
    },
    hotKeyPush : function() {
	return RIL.readSomething();
    },
    hotKeyOpenList : function() {
	RIL.toggleReadingList();
    },	
    hotKeyClickMode : function() {
	RIL.toggleClickToSaveMode();
    },	
    
    hotkeyText : function(p) {
	var key;
	var keycode;
	var keySet = RIL.PREFS.get('hotkey_'+p).split('||');
	if (keySet[0].length > 1) {
	    key = null;
	    keycode = keySet[1];
	} else {
	    key = keySet[1];
	    keycode = null;
	}
	return RIL.formatKey( keySet[0], key, keycode );
    },
    
    
    
    // -- XUL Helpers -- //
    
    // inMainWindow  means it should be in the main window, not the current document scope
    // for example: document inside of a sidebar is different then document inside of the main window
    xul : function(id, inMainWindow) {
	var doc = inMainWindow && this.inSidebar && RILsidebar ? RILsidebar.w.document : document;
        return doc.getElementById( this.XULnamespace + id );
    },
    
    xulId : function(id, inMainWindow) {
	var doc = inMainWindow && this.inSidebar && RILsidebar ? RILsidebar.w.document : document;
	return doc.getElementById( id );	
    },
    
    createNode : function (ty, attributes, htmlNamespace) {
	    var its;
	    var node = htmlNamespace ? document.createElementNS('http://www.w3.org/1999/xhtml', 'html:'+ty) : document.createElement(ty);
	    for(var ik in attributes) {
		    switch(ik) {
			    case('class'):
				    node.className = attributes[ik];
				    break;
			    case('style'):
				    if (typeof attributes[ik] == 'string') {
					    node.setAttribute('style', attributes[ik]);
				    } else {
					    its = attributes[ik].split(';');
					    for(var i=0; i<its.length; i++) {
						    parts = its[i].split(':');
						    node.style[parts[0]] = parts[1];
					    }
				    }
				    break;
			    case('innerHTML'):
				    node.innerHTML = attributes[ik];
				    break;
			    case('onclick'):
				    if (typeof attributes[ik] == 'string') {
					    node.setAttribute('onclick', attributes[ik]);
				    } else {
					    node.onclick = attributes[ik]
				    }
			    default:
				    node.setAttribute(ik, attributes[ik]);
		    }				
	    }
	    return node;
    },
	
    fillSelect : function(obj, min, max, selected)
    {
	if (!obj) return;
	selected = selected ? selected - min : 0 ;
	obj.removeAllItems();
	
	for(var i=min; i<=max; i++)
	{
	    obj.insertItemAt(i - 1, i, i);
	}
	obj.setAttribute('min', min);
	obj.selectedIndex = (selected > max - 1) ? (max - 1) : selected;
    },
    
    clearChildren : function(parent, cls) {
	for(var i=parent.childNodes.length - 1; i >= 0; i--) {
	    if (!cls || (cls && parent.childNodes[i].className.match(cls))) {
		parent.removeChild(parent.childNodes.item(i));
	    }
	}	
    },
    
    removeNode : function(node) {
	if (node) { return node.parentNode.removeChild(node); }
    },
    
    addClass : function(node, cls) {
	if (node != null && !node.className.match(cls)) node.className += ' ' + cls; 
    },
    
    removeClass : function(node, cls) {
	if (node != null) node.className = node.className.replace(cls,'');
    },
    
    // ewww... word-wrap: break-word would be much nicer..
    // #bug 520617 - https://bugzilla.mozilla.org/show_bug.cgi?id=520617
    wbrThisString : function(str, obj)
    {
	var longRegex = /[a-z0-9_\?\%\=\&]{30}/i;
	
	if (!str.match(longRegex))
	{
	    obj.textContent = str;
	} else
	{
	    // Walk through string and add wbr tags at the end of each long text section	    
	    var strRemainder = str;	    
	    var match = longRegex.exec(strRemainder);
	    var stringPart;
	    
	    while(match)
	    {   	    
		stringPart = strRemainder.substr(0, match.index) + match[0];
		this.addWbrToObjectForString(obj, stringPart);
		
		strRemainder = strRemainder.substr(match.index + match[0].length)
		match = longRegex.exec(strRemainder);
	    }
	    
	    this.addWbrToObjectForString(obj, strRemainder);
	    
	}
    },
    
    addWbrToObjectForString : function(obj, string)
    {		
	var part = RIL.createNode('span', false, true);
	part.textContent = '|'+string;
	obj.appendChild( part );
	obj.appendChild( RIL.createNode('wbr' , false, true ) );	
    },
    
    htmlDecode : function(str)
    {
	// TODO : find a faster/more effective method for this
	return !str.match('&') ? str : str.replace(/&quot;/gi, '"').replace(/&amp;/gi, '&') ;
    },
    
    whatIsTheClickTarget : function(e, defaultPref) {
	var targ;
        var userSetting = false;
	if (e.which != 3) {
	    if (e.which == 1) {
		if (e.ctrlKey || RIL.keyStates[224]) {//224
			targ = 'tab';
			RIL.keyStates[ 17 ] = false; //FF doesn't run keyup event when clicking
		} else if (e.shiftKey || RIL.keyStates[16]) {
			targ = 'window';
			RIL.keyStates[ 16 ] = false; //FF doesn't run keyup event when clicking
		} else if (defaultPref) {			
			targ = RIL.PREFS.get(defaultPref);
                        userSetting = true;
		}
	    } else if (e.which == 2) {
		targ = 'tab';	
	    }
	}
	return {targ:targ,which:e.which,userSetting:userSetting};
    },
        
    findPos : function (obj) {
	var curleft = curtop = 0;
	if (obj.offsetParent) {
	    curleft = obj.offsetLeft
	    curtop = obj.offsetTop
	    while (obj = obj.offsetParent) {
		curleft += obj.offsetLeft
		curtop += obj.offsetTop
	    }
	}
	return [curleft,curtop];
    },
	
    bubbleToTagName : function(obj, tagName) {
	var maxlvls = 10;
	var lvl = 1;
	while (obj.tagName != tagName) {
	    if (obj.parentNode) { 
		obj = obj.parentNode;
	    }
	    if (lvl >= maxlvls) { return false; }
	    lvl++;
	}
	return obj;
    },
	
    keyDown : function(e) {
	RIL.keyStates[ e.keyCode ] = true;
    },
    keyUp : function(e) {
	RIL.keyStates[ e.keyCode ] = false;		
    },
    
    contextPopupShowing : function() {
	if (RIL.PREFS.getBool('context-menu')) {
	    if ( (gContextMenu.onSaveableLink || ( gContextMenu.inDirList && gContextMenu.onLink )) ) {
		gContextMenu.showItem(RIL.XULnamespace + "context_saveLink", true);
		gContextMenu.showItem(RIL.XULnamespace + "context_savePage", false);
		gContextMenu.showItem(RIL.XULnamespace + "context_clickMode", false);
	    } else if (gContextMenu.isTextSelected) {
		gContextMenu.showItem(RIL.XULnamespace + "context_saveLink", false);
		gContextMenu.showItem(RIL.XULnamespace + "context_savePage", false);
		gContextMenu.showItem(RIL.XULnamespace + "context_clickMode", false);
	    } else if (!gContextMenu.onTextInput) {
		gContextMenu.showItem(RIL.XULnamespace + "context_saveLink", false);
		gContextMenu.showItem(RIL.XULnamespace + "context_savePage", true);
		gContextMenu.showItem(RIL.XULnamespace + "context_clickMode", true);
	    } else {
		gContextMenu.showItem(RIL.XULnamespace + "context_saveLink", false);
		gContextMenu.showItem(RIL.XULnamespace + "context_savePage", false);
		gContextMenu.showItem(RIL.XULnamespace + "context_clickMode", false);
	    }
	} else {
	    gContextMenu.showItem(RIL.XULnamespace + "context_saveLink", false);
		gContextMenu.showItem(RIL.XULnamespace + "context_savePage", false);
		gContextMenu.showItem(RIL.XULnamespace + "context_clickMode", false);
	}
    },
    
    
    // -- Document Helpers -- //
    
    currentURL : function(checkForOffline) { //checkForOffline will look for the real url if the currentURL is an offline url
	if (checkForOffline) {
	    var currentItem = RIL.getItemForCurrentPage();
	    if (currentItem && currentItem.item && currentItem.offline)
	    {
		return currentItem.item.url;
	    }
	}
	return ( (!getBrowser().currentURI.spec) ? (false):(getBrowser().currentURI.spec) );
    },
    currentTitle : function() {
	return getBrowser().contentDocument.title;
    },    
    getSidebarWidth : function (w) {
	    return window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
		    .getInterface(Components.interfaces.nsIWebNavigation)
		    .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
		    .rootTreeItem
		    .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
		    .getInterface(Components.interfaces.nsIDOMWindow).document.getElementById("sidebar-box").width;
   },
    
    setSidebarWidth : function (w) {
	    window.QueryInterface(Components.interfaces.nsIInterfaceRequestor)
		    .getInterface(Components.interfaces.nsIWebNavigation)
		    .QueryInterface(Components.interfaces.nsIDocShellTreeItem)
		    .rootTreeItem
		    .QueryInterface(Components.interfaces.nsIInterfaceRequestor)
		    .getInterface(Components.interfaces.nsIDOMWindow).document.getElementById("sidebar-box").width=w;
   },
   
   
    
    // -- Helpers -- //
    
    
    l : function(id){
        //this.APP.d(id);
	return this.xul('strings', true).getString(id);
    },
    
    
    // -- Tab Candy -- //
    // TODO: Migrate into it's own object
        
    tcLookForLoad : function()
    {
        if (document.getElementById('tab-view') && !RIL.tcInited)
        {
            RIL.tcInited = true;
            RIL.tcInit();
        }
    },
    
    tcInit : function()
    {
        this.tv = document.getElementById('tab-view');
        this.tv.addEventListener("DOMContentLoaded", this.tcFinishInit, false);
    },
    
    tcFinishInit : function()
    {
        try
        {            
            var tv = document.getElementById('tab-view');
            var doc = tv.contentDocument;
            
            if (doc.RIL)
                return;
            
            doc.RIL = RIL;
            
            // Add RIL css
            var css = doc.createElement('link');
            css.setAttribute('rel', 'stylesheet');
            css.setAttribute('href', 'chrome://isreaditlater/content/tc.css');
            css.setAttribute('type', 'text/css');
            tv.contentDocument.body.appendChild(css);
            
            // Add RIL script
            var script = doc.createElement('script');
            script.type = 'text/javascript';
            script.src = 'chrome://isreaditlater/content/tcDropSpot.js';
            tv.contentDocument.body.appendChild(script);
    
            // Add RIL script
            var script = doc.createElement('script');
            script.type = 'text/javascript';
            script.src = 'chrome://isreaditlater/content/tc.js';
            tv.contentDocument.body.appendChild(script);
        } catch(e)
        { 
	    Components.utils.reportError(e);
        }
    }

}
RIL = new RIL();

window.addEventListener("load", function() { setTimeout(function(){RIL.init();},100)}, false);
window.addEventListener("unload", function() {RIL.uninit();}, false);

