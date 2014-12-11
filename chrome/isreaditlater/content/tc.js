function RILTabCandy()
{
    
}

var RILPENDINGDROP;

RILTabCandy.prototype =
{
    
    // Create drop spot
    init : function()
    {
        var box = new Rect(Items.getPageBounds());
        box.width = 40;
        box.height = 48;
        
        var infoItem = new DropSpot(box);
        infoItem.html('<div class="logo"></div>');
        infoItem.setResizable = false;
        
        infoItem.droppable(true);
        infoItem.dropOptions = {
            accept : this.dropAccept,
            over : this.dropOver,
            out : this.dropOut,
            drop : this.dropped
        }
        
        this.dropspot = infoItem;
        this.$dropspot = iQ(infoItem.container);
        
        this.$dropspot.click(function()
        {
            alert('Drag tabs or groups here to save to Pocket.');
            //window.UI.hideTabView();document.RIL.openReadingList();
        });
        
        setTimeout(function(){RILtc.$dropspot.animate({width:40});}, 50);
        
    },
    
    
    // Droppable
    
    dropAccept : function(item)
    {
        try{
        RILtc.pendingDrop = item;
        
        iQ(document).mousemove(RILtc.mouseMoved)
        
        // tabItem
        if (item.isATabItem)
        {
            return true;
        }
        
        // groupItem
        else if (item.isAGroupItem)
        {
            return true;
        }
        
        return false;
        }catch(e){/*alert(e)*/}
    },
    
    dropOver : function()
    {
        RILtc.dropIsOn = true;
        RILtc.$dropspot.addClass('hovered');        
        RILtc.$dropspot.animate({width:55});
        RILtc.pendingDrop.container.style.opacity = 0.6;
    },
    
    dropOut : function()
    {
        RILtc.dropIsOn = false;
        RILtc.$dropspot.removeClass('hovered');       
        RILtc.$dropspot.animate({width:40});
        RILtc.pendingDrop.container.style.opacity = 1;
    },
    
    mouseMoved : function(e)
    {
        try
        {            
        if (!RILtc.pendingDrop || !RILtc.dropIsOn)
        {
            if (RILtc.addButton)
                RILtc.addButton.style.left = '-789em';
            return;
        }
            
        var mouseX = e.pageX;
        var mouseY = e.pageY;
        
        // Add button
        if (!RILtc.addButton)
        {
            RILtc.addButton = document.createElement('div');
            RILtc.addButton.style.background = 'url(chrome://isreaditlater/skin/add.png) center no-repeat';
            RILtc.addButton.style.width = '16px';
            RILtc.addButton.style.height = '16px';
            RILtc.addButton.style.zIndex = 100000000;
            RILtc.addButton.style.position = 'absolute';
            document.body.appendChild(RILtc.addButton);
        }
        
        // Position the button
        RILtc.addButton.style.left = (mouseX + 10) + 'px';
        RILtc.addButton.style.top = (mouseY + 10) + 'px';
        }catch(e){/*alert(e)*/}
    },
    
    dropped : function()
    {
        try
        {
        if (!RILtc.pendingDrop)
            return;
                
        RILtc.dropOut();
        RILtc.mouseMoved();
        
        var itemsToSave = [];
        var groupChildren;
        var tags = '';
        
        // Single tabItem, create a children array with single tab
        if (RILtc.pendingDrop.isATabItem)
            groupChildren = [RILtc.pendingDrop];
        
        // Group, just use the groups children    
        else if (RILtc.pendingDrop.isAGroupItem)
        {
            tags = RILtc.pendingDrop.getTitle();
            groupChildren = RILtc.pendingDrop._children;
        }
        
        // Check that we have some items to save
        if (!groupChildren)
            return;
        
        // Save tabs
        document.RIL.saveArrayOfTabs(groupChildren, {tags:tags});
        
        // Close the tab or group
        var dropbounds = RILtc.dropspot.getBounds();
        
        if (RILtc.pendingDrop.isAGroupItem)
        {
            if (!RILtc.pendingDrop.locked)
                RILtc.pendingDrop.locked = {};
            RILtc.pendingDrop.locked.close = true;
            RILtc.pendingDrop.closeAll();
        }
        
        iQ(RILtc.pendingDrop.container).animate({
            left: dropbounds.left + 45,
            top: dropbounds.top + 10,
            width: 10,
            height: 10,
            opacity: 0
        },
        {
            complete : function()
            {
                RILtc.pendingDrop.close();
            }
        });
            
        } catch(e){alert(e)}
    }
}

try
{
    
    var log = '';

var RILtc = new RILTabCandy();
RILtc.init();

} catch(e){/*alert(e)*/}
