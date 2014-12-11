function RILshare()
{
    
}
RILshare.prototype = {
    
    itemShareContext : function(menupopup)
    {
        /*
        // move contents of share popup
        var fromNodes = RIL.xul('share').childNodes;
        var to = RIL.xul('item_shareContent')
        if (to.childNodes.length < 2)
        {
            while( fromNodes[ 0 ] )
            {
                to.appendChild( fromNodes[ 0 ] );
            }
        }*/
    },
    
    populateShareMenu : function(fromContext, url)
    {
        // Get Lists
        this.sortSites();
        this.getTopList();
        
        var content = RIL.xul('shareContent' + (fromContext ? 'Context' : '') );
        var moreContent = RIL.xul('shareMoreContent' + (fromContext ? 'Context' : '') );
        var i, node;
        
	RIL.clearChildren( content );
	RIL.clearChildren( moreContent );
        
        for(i in this.topSiteIds)
        {
            node = RIL.createNode('menuitem', {label:this.siteDirectory[this.topSiteIds[i]].name, siteId:this.topSiteIds[i], url:url?url:null});
            node.onclick = this.shareSiteSelected;
            content.appendChild( node );
            if (i > 5) break;
        }        
        
        var categoryContainers = {};
        var menu;
        
        for(i in this.categories)
        {
            menu = RIL.createNode('menu', {label:this.categories[i]});
            moreContent.appendChild( menu );
            
            categoryContainers[i] = RIL.createNode('menupopup', {position:'start_before'});
            menu.appendChild( categoryContainers[i] );           
        }
        
        var site, cats, j;
        for(i in this.siteIndex)
        {
            site = this.siteIndex[i];
            cats = typeof site.cat == 'object' ? site.cat : [site.cat];
            
            if (site.macOnly && !navigator.platform.match(/mac/i)) continue;
            
            for(j in cats)
            {
                node = RIL.createNode('menuitem', {label:site.name, siteI:i, url:url?url:null});
                node.onclick = this.shareSiteSelected;
                categoryContainers[cats[j]].appendChild( node );
            }
        }
    },
    
    // -- //
    
    sortSites : function()
    {
        if (this.sorted) return;
        
        var id;
        this.siteIndex = [];
        for(id in this.siteDirectory)
        {
            this.siteIndex.push( this.siteDirectory[id] );
            this.siteDirectory[id].id = id;
        }
        
        this.siteIndex.sort(this.sortByName);
    },
    
    sortByName : function(a, b)
    {
        return a.name > b.name ? 1 : -1;  
    },
    
    // -- //
    
    getTopList : function()
    {        
        RIL.APP.PREFS.setIfDoesNotExist('share-top-sites', 'delicious|twitter|facebook|google_reader|email');
        var str = RIL.APP.PREFS.get('share-top-sites');
        this.topSiteIds = str.split('|');
    },
    
    moveSiteToTop : function(site)
    {
        var i = this.topSiteIds.indexOf( site.id );
        
        if (i >= 0)
            this.topSiteIds.splice(i, 1);
        
        var str = site.id + '|' + this.topSiteIds.slice(0,5).join('|');
        RIL.APP.PREFS.set('share-top-sites', str);
    },
    
    // -- //
    
    shareSiteSelected : function(e)
    {
        var site;
        if (this.getAttribute('siteId'))
        {
            site = RILshare.siteDirectory[ this.getAttribute('siteId') ];
        } else {
            site = RILshare.siteIndex[ this.getAttribute('siteI') ];
        }
        
        RILshare.shareCurrentPageWithSite( site, this.getAttribute('url') ); 
    },
    
    shareCurrentPageWithSite : function(site, url)
    {
        try
        {
        var title;
        if (!url)
        {
            url = RIL.currentURL(true);
            title = RIL.currentTitle();
        }
        else {
            var item = RIL.APP.LIST.itemByUrl(url);
            title = item ? item.title : '';
        }
        
        
        // Basic - open url
        if (site.url)
        {
            var shareurl = this.replaceUrlStringTags(site.url, url, title);
            if (shareurl)
                RIL.openUrl(shareurl, {targ:(site.sameTab ? 'current' : 'tab'), ig:true});                
        }
        
        // Basic - run bookmarklet
        else if (site.bookmarklet)
        {
            RIL.openUrl(site.bookmarklet, {ig:true});
        }
        
        // Custom -
        else
        {
            if (this['custom_'+site.id])
                this['custom_'+site.id](url, title);
        }
        
        // Update top sites
        this.moveSiteToTop( site );      
        RIL.APP.SYNC.share(url, site.id);
        
	}catch(e){Components.utils.reportError(e);}
    },
    
    replaceUrlStringTags : function(shareurl, url, title)
    {
        // Tags
        // {!URL}
        // {!TITLE}
        // {!TEXT} - try to generate text for the page, then share
        // {!SELECTION} - grab currently selected text
        // {!SELECTIONTHENTEXT} - try to grab a selection and if it doesn't exist, grab the text view
               
        
        shareurl = shareurl.replace('{!URL}', encodeURIComponent(url));        
        shareurl = shareurl.replace('{!TITLE}', encodeURIComponent(title));
        
        var selectReplaced = false;
        var selection = window.getSelection();
        var text;
        if (selection && selection.toString.length > 0)
        {
            text = RIL.APP.e(selection.toString);
            shareurl = shareurl.replace('{!SELECTION}', text); 
            shareurl = shareurl.replace('{!SELECTIONTHENTEXT}', text);
            selectReplaced = true;
        }       
       
        /*if (
            ( shareurl.match('{!TEXT}') || (!selectReplaced && shareurl.match('{!SELECTIONTHENTEXT}') ) )
            )
        {
            
            
            text = RIL.APP.e('Email text is not supported in beta 1.  It will be added in the next beta.');            
            shareurl = shareurl.replace('{!SELECTIONTHENTEXT}', text);
            shareurl = shareurl.replace('{!TEXT}', text);
        }*/
        
        return shareurl;
    },
        
        
    // -- Special Cases -- //
    
    custom_Firefox : function(url, title)
    {
        window.top.PlacesCommandHook.bookmarkLink(PlacesUtils.bookmarksMenuFolderId, url, title);
    },
    
    custom_echofonff : function(url, title)
    {
        if (!gTwitterNotifier)
        {
            RIL.APP.PROMPT.alert(window, 'Cannot share', 'You do not have the Echofon Firefox extension installed');
        }
        else {
            gTwitterNotifier.onInsertURL( url );
        }
    },
    
    // --- //
    
    
    categories : [
        'Applications',//0
        'Bookmarks', //1
        'News', //2
        'Social Network', //3
        'Posting' //4
    ],
    
    siteDirectory : {
        
        // Custom
        
        'Firefox' : {
            name	:'Firefox',
            cat         :[0,1]
        },
	'twitter' : {
            name	:'Twitter',
            url         :'chrome://isreaditlater/content/twitter.html?url={!URL}&title={!TITLE}',
            cat         :4
	},
        
        
        // URLs and bookmarklets
        
	'email' : {
            name	:'Email',
            url		:'mailto:?subject={!TITLE}&body={!URL}',
            cat         :0,
            sameTab     : true
	},
	'reddit' : {
            name	:'Reddit',
            url		:'http://reddit.com/submit?url={!URL}&title={!TITLE}',
            cat         :2
	},
	'digg' : {
            name	:'Digg',
            url		:'http://digg.com/submit?phase=2&url={!URL}&title={!TITLE}',
            cat         :2
	},
	'facebook' : {
            name	:'Facebook',
            url		:'http://www.facebook.com/share.php?u={!URL}',
            cat         :3
	},
	'myspace' : {
            name	:'MySpace',
            url		:'http://www.myspace.com/Modules/PostTo/Pages/?l=3&u={!URL}&t={!TITLE}&c=',
            cat         :3
	},
	'delicious' : {
            name	:'Delicious',
            url		:'http://del.icio.us/post?url={!URL}&title={!TITLE}',
            cat         :1
	},
	'stumbleupon' : {
            name	:'Stumbleupon',
            url		:'http://www.stumbleupon.com/submit?url={!URL}&title={!TITLE}',
            cat         :1
	},
	'ybuzz' : {
            name	:'Yahoo Buzz',
            url		:'http://buzz.yahoo.com/submit/?submitUrl={!URL}&submitHeadline={!TITLE}',
            cat         :2
	},
	'mixx' : {
            name	:'Mixx',
            url		:'http://www.mixx.com/submit?page_url={!URL}',
            cat         :2
	},
	'google_bmarks' : {
            name	:'Google Bookmarks',
            url		:'http://www.google.com/bookmarks/mark?op=edit&bkmk={!URL}&title={!TITLE}',
            cat         :1
	},
        'google_reader' : {
            name	:'Google Reader',
            url		:'http://www.google.com/reader/link-frame?url={!URL}&srcUrl={!URL}&title={!TITLE}&srcTitle={!TITLE}',
            cat         :2
	},
	'yahoo_bmarks' : {
            name	:'Yahoo Bookmarks',
            url		:'http://bookmarks.yahoo.com/toolbar/savebm?opener=tb&u={!URL}&t={!TITLE}',
            cat         :1
	},
	'windows_live' : {
            name	:'Windows Live',
            url		:'https://favorites.live.com/quickadd.aspx?marklet=1&mkt=en-us&url={!URL}&title={!TITLE}&top=1',
            cat         :1
	},
	'friendfeed' : {
            name	:'FriendFeed',
            url		:'http://friendfeed.com/share?url={!URL}&title={!TITLE}',
            cat         :3
	},
	'newsvine' : {
            name	:'Newsvine',
            url		:'http://www.newsvine.com/_tools/seed&save?popoff=0&u={!URL}&h={!TITLE}',
            cat         :2
	},
	'linkedin' : {
            name	:'LinkedIn',
            url		:'http://www.linkedin.com/shareArticle?mini=true&url={!URL}&title={!TITLE}&summary=&source=',
            cat         :3
	},
	'slashdot' : {
            name	:'Slashdot',
            url		:'http://slashdot.org/bookmark.pl?url={!URL}&title={!TITLE}',
            cat         :2
	},
	'diigo' : {
            name	:'Diigo',
            url		:'http://secure.diigo.com/post?url={!URL}&title={!TITLE}',
            cat         :1
	},
	'tweetie' : {
            name	:'Tweetie',
            url		:'tweetie:{!TITLE} {!URL}',
            macOnly     :true,
            cat         :[0,4],
            sameTab     : true
	},
	'echofonmac' : {
            name	:'Echofon Mac',
            url		:'echofon:{!TITLE} {!URL}',
            macOnly     :true,
            cat         :[0,4],
            sameTab     : true
	},
	'echofonff' : {
            name	:'Echofon Firefox',
            cat         :[0,4]
	},
	'evernote' : {
            name	:'Evernote',
            url		:'http://evernote.com/clip.action?url={!URL}&title={!TITLE}',
            cat         :1
	},
        
        'Connotea' : {
            name	:'Connotea',
            url		:'http://www.connotea.org/add?continue=return&uri={!URL}&title={!TITLE}',
            cat         :1
        },
        
        'bitly' : {
            name	:'Bit.ly',
            domain      :'bit.ly',
            url 	:"http://bit.ly/?url={!URL}",
            cat         :4
        },
        
        'posterous' : {
            name        :'Posterous',
            domain      :'posterous.com',
            url         :"http://ping.fm/ref/?method=microblog&title='+{!TITLE}+'&link='+{!URL}+'&body='+{!SELECTION}",
            cat         :4
        }
        
    }
}


RILshare = new RILshare();