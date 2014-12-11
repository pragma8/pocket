// Scripts hacked together from:
// http://mxr.mozilla.org/firefox/source/browser/components/places/content/controller.js#735
// http://mxr.mozilla.org/firefox/source/browser/components/places/content/utils.js#890

function RILplaces()
{
    this.APP = Components.classes['@ril.ideashower.com/rildelegate;1'].getService().wrappedJSObject;    
}
RILplaces.prototype =
{
    init : function()
    {
        document.getElementById('placesContext').addEventListener("popupshowing", function() { return RILplaces.contextShowing() }, false);  
    },
    
    saveView : function(view, event)
    {try{
        if (!this.APP)
        {
            Components.utils.reportError('Error saving bookmark folder: Could not activate Pocket');
            return;
        }
        
        if (!this.APP.showLoginPromptIfNeeded()) return;
        
        var urlsToOpen = [];
        var node = view.selectedNode;
        
        if (node && PlacesUtils.nodeIsContainer(node))
        {
            urlsToOpen = this.getItemsForContainerNode(node);
            return this.saveUrlsFromView(urlsToOpen, event);
        }
        
        // else
        var nodes = view.getSelectionNodes();
        for (var i=0; i < nodes.length; i++)
        {
          // skip over separators and folders
            if (PlacesUtils.nodeIsURI(nodes[i]))
                urlsToOpen.push({uri: nodes[i].uri, title:nodes[i].title, isBookmark: PlacesUtils.nodeIsBookmark(nodes[i])});
        }
        
        return this.saveUrlsFromView(urlsToOpen, event);
    }catch(e){Components.utils.reportError(e);}
    },
    
    saveUrlsFromView : function(items, event)
    {
        for (var i = 0; i < items.length; i++)
        {
            var item = items[i];
            if (item.isBookmark && item.uri)
            {
                this.APP.LIST.add( {url:item.uri, title:item.title}, true );
            }
        }  
        
        this.APP.LIST.endBatchAndRefresh();                       
    },
    
    // From getURLsForContainerNode
    // http://mxr.mozilla.org/firefox/source/toolkit/components/places/src/utils.js#948
    // added the node title to the item
    
    getItemsForContainerNode : function(aNode)
    {
        var urls = [];
     if (PlacesUtils.nodeIsFolder(aNode) && asQuery(aNode).queryOptions.excludeItems) {
       // grab manually
       var itemId = PlacesUtils.getConcreteItemId(aNode);
       var contents = PlacesUtils.getFolderContents(itemId, false, false).root;
       for (var i = 0; i < contents.childCount; ++i) {
         var child = contents.getChild(i);
         if (PlacesUtils.nodeIsURI(child))
           urls.push({uri: child.uri, title:child.title, isBookmark: PlacesUtils.nodeIsBookmark(child)});
       }
     }
     else {
       var result, oldViewer, wasOpen;
       try {
         var wasOpen = aNode.containerOpen;
         result = aNode.parentResult;
         oldViewer = result.viewer;
         if (!wasOpen) {
           result.viewer = null;
           aNode.containerOpen = true;
         }
         for (var i = 0; i < aNode.childCount; ++i) {
           // Include visible url nodes only
           var child = aNode.getChild(i);
           if (PlacesUtils.nodeIsURI(child)) {
             // If the node contents is visible, add the uri only if its node is
             // visible. Otherwise follow viewer's collapseDuplicates property,
             // default to true
             if ((wasOpen && oldViewer && child.viewIndex != -1) ||
                 (oldViewer && !oldViewer.collapseDuplicates) ||
                 urls.indexOf(child.uri) == -1) {
               urls.push({ uri: child.uri, title:child.title,
                           isBookmark: PlacesUtils.nodeIsBookmark(child) });
             }
           }
         }
         if (!wasOpen)
           aNode.containerOpen = false;
       }
       finally {
         if (!wasOpen)
           result.viewer = oldViewer;
       }
     }
 
     return urls;

    },
    
    //http://mxr.mozilla.org/firefox/source/browser/components/places/content/controller.js#577
    contextShowing : function()
    { 
        try {
        var view = PlacesUIUtils.getViewForNode(document.popupNode);
        var item = document.getElementById("RIL_saveFolder");
        
        if (!item.hidden && view.selectedNode &&
            PlacesUtils.nodeIsContainer(view.selectedNode))
        {
            item.disabled = !PlacesUtils.hasChildURIs(view.selectedNode);
        }
        else
        {
            // see selectiontype rule in the overlay
            item.disabled = item.hidden;
        }
        
        item.parentNode.insertBefore( item, document.getElementById('placesContext_openSeparator'));
        } catch(e){Components.utils.reportError(e);}
        return;
    }
}

RILplaces = new RILplaces();


window.addEventListener("load", function() {RILplaces.init();}, false);