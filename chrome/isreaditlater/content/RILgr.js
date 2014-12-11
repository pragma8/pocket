function RILgr()
{
    this.empty = 'chrome://isreaditlater/skin/book16_hollow_trans.png';
    this.full = 'chrome://isreaditlater/skin/book16_urlbar.png';
    this.TO = null;
}

RILgr.prototype = {
        
    _init : function() {
                    
    },
    
    _initpage : function() {
        if (RIL.APP.PREFS.getBool('integrate-gr')) {
            if (content.document.getElementById('entries')) {
                content.document.getElementById('entries').addEventListener('DOMNodeInserted', RILgr.readyUpdate, false);
            }
            RIL.xulId("appcontent").removeEventListener("DOMContentLoaded", RILgr.readyInit, false);
            content.document.addEventListener('keydown', RILgr.Toggle, true);
            
            RILgr.readyUpdate();
        }
    },
    
    check : function() {
        if (RIL.APP.PREFS.getBool('integrate-gr')) {
            var u = RIL.currentURL();
            
            if (u.match(/^https?:\/\/reader\.google\.(.+)/) || u.match(/^https?:\/\/([^.]+\.)?google\.(.+)\/reader/)) {
                RIL.xulId("appcontent").addEventListener("DOMContentLoaded", RILgr.readyInit, false);
                return;
            }
        }
        RIL.xulId("appcontent").removeEventListener("DOMContentLoaded", RILgr.readyInit, false);
        clearInterval(this.checkingForRefresh);
    },
    
    readyInit : function() {
        setTimeout(RIL.APP.genericClosure(RILgr, '_initpage'), 1900);
    },
    
    readyUpdate : function() {
        clearInterval(RILgr.TO);
        RILgr.TO = setTimeout(RIL.APP.genericClosure(RILgr, 'updateEntries'), 100);
    },
    
    updateEntries : function() {
        var org, titleLink, checkmark, viewType, pageTitle, sec, source, ctn, friends;
        this.marks = {};
        
        var entries = this.getElementsByClassName(content.document, 'entry', null, 'ril-set');
        if (entries.length > 0) {           
            
            for(var i = 0; i<entries.length; i++) {
                
                if (!entries[i].className.match('ril-set')) {
                    
                    //Create Checkmark
                    checkmark = content.document.createElement('img');
                    
                    //Determine View Type
                    org = this.getElementsByClassName(entries[i], 'entry-original')[0];
                    titleLink = this.getElementsByClassName(entries[i], 'entry-title-link')[0];
                    
                    if (org || titleLink) {
                    
                        if (org) {
                            
                            viewType = 'list';
                            
                            url = org.href;
                            pageTitle = this.getElementsByClassName(entries[i], 'entry-title')[0].innerHTML;
                            sec = this.getElementsByClassName(entries[i], 'entry-secondary')[0];
                            source = this.getElementsByClassName(entries[i], 'entry-source-title')[0];
                            friends = this.getElementsByClassName(entries[i], 'entry-source-friends')[0];
                            ctn = content.document.getElementById('entries').className.match('single-source') ? sec : source;
                            
                            checkmark.style.marginRight = '9px';
                            checkmark.style.marginTop = '8px';
                            checkmark.style.marginLeft = '2px';
                            
                        } else if (titleLink) {

                            viewType = 'expanded';
                            
                            url = titleLink.href;
                            pageTitle = titleLink.innerHTML.replace(/<([^>]+)>/, '').replace(/(^\s+|\s+$)/, '') + '';
                            ctn = this.getElementsByClassName(entries[i], 'entry-icons')[0];                               
                            
                            
                            checkmark.style.position = 'relative';
							checkmark.style.top = '25px';
							checkmark.style.left = '24px';                            
                        }
                    
                        //Set Checkmark attributes
                        let inList = RIL.APP.LIST.itemByUrl(url);
                        checkmark.src = inList ? this.full : this.empty;
                        checkmark.width = 15;
                        checkmark.height = 15;
                        checkmark.style.cursor = 'pointer';
                        checkmark.style.verticalAlign = 'top';
                        checkmark.className = 'RIL-checkmark';
                        if (friends)
                        {
                            checkmark.style.cssFloat = 'left';
                            checkmark.style.marginTop = '3px';
                        }
                        
                        //Get Info and Nodes
                        checkmark.setAttribute('url', url);
                        checkmark.setAttribute('pageTitle', pageTitle);
                        checkmark.addEventListener("click", this.clickMark, true);
                        
                        //Add Checkmark
                        ctn.insertBefore( checkmark , ctn.firstChild );
                    }
                        
                    entries[i].className += ' ril-set';
                }
            }
            
            clearInterval(this.checkingForRefresh)
            this.checkingForRefresh = setInterval( this.checkForRefresh, 1000 );
        }
    },
    
    checkForRefresh : function()
    {
        try{
        if (RILgr.listWasRefreshed)
        {
            RILgr.listWasRefreshed = false;
            
            let marks = content.document.getElementsByClassName('RIL-checkmark');
            let url, checkmark;
            
            for(let i=0; i<=marks.length; i++)
            {
                checkmark = marks[i];
                
                if (checkmark)
                {
                    url = checkmark.getAttribute('url');
                    checkmark.src = RIL.APP.LIST.itemByUrl(url) ? RILgr.full : RILgr.empty;
                }
            }
        }
        }catch(e){Components.utils.reportError(e);}
    },
    
    clickMark : function(e, obj) {
        if (e) {
            e.stopPropagation();
            obj = this;
        }
        if (obj.src == RILgr.full) {
            let item = RIL.APP.LIST.itemByUrl( obj.getAttribute('url') );
            if (item)
                RIL.APP.LIST.mark( item.itemId );
            else
                RIL.APP.d('could not find ' + obj.getAttribute('url'));
            obj.src = RILgr.empty;                
        } else {
            RIL.saveLink( obj.getAttribute('url') , obj.getAttribute('pageTitle') );
            obj.src = RILgr.full;
        }
    },
    
    Toggle : function(e) {
        var item;
        if (e.target.tagName != 'INPUT' && e.target.tagName != 'TEXTAREA') {
            if ( String.fromCharCode(e.keyCode).toUpperCase() ==  RIL.APP.PREFS.get('hotkey_gr').toUpperCase() ) {
                item = RILgr.getElementsByClassName(content.document.getElementById('current-entry'), 'RIL-checkmark')[0];
                if (item) {
                    RILgr.clickMark(null, RILgr.getElementsByClassName(content.document.getElementById('current-entry'), 'RIL-checkmark')[0] );
                }
            }
        }
    },
    
    // -- //
    
    getElementsByClassName  : function (parent, className, nodeName, notClassName) {
        var result = [], tag = nodeName||'*', node, seek, i;
        var rightClass = new RegExp( '(^| )'+ className +'( |$)' );
        var wrongClass = new RegExp( '(^| )'+ notClassName +'( |$)' );
        seek = parent.getElementsByTagName( tag );
        for(var i=0; i<seek.length; i++ )
          if( rightClass.test( (node = seek[i]).className ) && !wrongClass.test( (node = seek[i]).className ) )
            result.push( seek[i] );
        return result;
    },      
        
}

RILgr = new RILgr();