importScripts('chrome://isreaditlater/content/RILassetManager.js');

var Components = false;

function processor(data)
{
    for(var i in data)
    {
        this[i] = data[i];
    }
    
    // Because only one specific item of content is ever processed at a time, we dropped the need to do contentId lookups with this
    //this.dupeCheckAbsolute = {}; // absolute is handled in the scope of RILwebDownloader
    this.dupeCheckLiteral = {}; // literals are handled in the scope per file (per processor thread)    
}

processor.prototype = {
    
    run : function()
    {
        //dump("\nprocessor " + this.url);
        this.init();
        
        switch(this.action)
        {
            case('processMarkup'):
                this.processMarkup();
                break;
            
            case('processStylesheet'):
                this.processStylesheet();
                break;
            
        }
    },
    
    init : function()
    {
        this.ASSETS = new RILassetManager();
        this.ASSETS.setPaths(this.assetPaths);
    },
    
    processMarkup : function()
    {               
        //dump("\nprocessMarkup");         
        // Begin Scan for images
        this.markup = this.processImages( this.markup, 'markup', 1);        
        this.markup = this.processImages( this.markup, 'markup', 2 );
        
        // Begin Scan for stylesheets
        this.markup = this.processStylesheets( this.markup, 'markup', 1);        
        this.markup = this.processStylesheets( this.markup, 'markup', 2);
        
        // Replace relative links
        this.markup = this.processLinks( this.markup );
        
        // Replace charset with UTF-8
        this.markup = this.markup.replace(/content=['"]([^"']*)charset=[^"']*/i, 'content="$1charset=UTF-8');
        
        this.returnToMain( {markup:this.markup} );
    },
    
    processStylesheet : function()
    {
        //dump("\processStylesheet");                
        this.markup = this.processStylesheets(this.markup, this.url, 2, this.itemInfo);
        this.markup = this.processImages(this.markup, this.url, 2, this.itemInfo);
        
        // Strip any remaining items with absolute urls
        this.markup = this.markup.replace(/(['"\(])?https?:\/\//gi, '$1/UNREPLACEDABSOLUTE/');
        
        this.returnToMain( {markup:this.markup, itemInfo:this.itemInfo} );        
    },
    
    processImages : function( content, contentId, type, itemInfo )
    {
        //dump("\processImages");
        this.imagesProcessed = false;
        
        var literal, match, matchSplit;	
        var regex = type == 1 ? /<(\s)?(img|input) ([^>]*)?src=["']([^"']*)["']/gi : /background(-image)?:[^;}\(]*url\(['"]?([^'"\(\)]*)['"]?\)/gi;
        
        // Take markup and scan for img tags                
        match = regex.exec(content);
        while(match)
        {
            literal = match[ type==1 ? 4 : 2 ];
            content = this.processAsset(literal, content, contentId, 1, itemInfo ? itemInfo.absolute : null);
            
            // Next match
            match  = regex.exec(content);
        }
        
        this.imagesProcessed = true;
        
        return content;   
    
    },
    
    processStylesheets : function(content, contentId, type, itemInfo)
    {
        //dump("\processStylesheets");
        
        this.stylesheetsProcessed = false;
        
        if (content) {
            
            var literal, match, matchSplit, capture1, capture2, processIt;	
            var regex = type == 1 ? /<(\s)?link ([^>]*)?href=["']([^"']*)["']([^>]*)?/gi : /@import\s*(url\()?['"]?([^'"\(\)]*)['"]?/gi;
            
            
            // Take markup and scan for css links and imports                
            match = regex.exec(content);
            while(match)
            {
                processIt = false;
                
                if (type == 1)
                {
                    literal = match[ 3 ];
                    if (literal)
                    {
                        // There is an href, now check if it has a rel="stylesheet" before or after it
                        capture1 = match[2];
                        capture2 = match[4];
                        
                        if ( (capture1 && capture1.match(/stylesheet/i)) || (capture2 && capture2.match(/stylesheet/))) processIt = true;
                    }
                    
                } else {
                    literal = match[2];
                    if (literal) processIt = true;
                }
                
                if (processIt) content = this.processAsset(literal, content, contentId, 2, itemInfo ? itemInfo.absolute : null);
                
                // Next match
                match  = regex.exec(content);
            }
            
            this.stylesheetsProcessed = true;
        }
        
        return content;
    },
    
    processLinks : function(content)
    {
        //dump("\processLinks");
        
        if (content) {
            
            try {
                var literal, match, absolute;	
                var regex = /<(\s)?a ([^>]*)?href=["']([^"']*)["']([^>]*)?/gi;
                var searchContent = content;
                
                // Take markup and scan for links
                match = regex.exec(searchContent);
                while(match)
                {
                    literal = match[ 3 ];
                    if (literal.length && !literal.match(/^(\#|https?:\/)/i)) 
                    {
                        absolute = this.ASSETS.getAbsoluteFromRelative( literal, this.url );
                        if (absolute && absolute != literal)
                        {
                            content = content.replace( literal , absolute );
                        }
                    }
                    
                    // Next match
                    match  = regex.exec(searchContent);
                }
            } catch(e)
            {
                content = searchContent;
            }
        }
        
        return content;
    },
    
    processAsset : function(literal, content, contentId, type, baseURL)
    {
        //dump("\processAsset");
        try {
            
            // Check to make sure it's not an asset path (already processed)
            if (!literal || !literal.match(/\S/) || literal.match('RIL_assets')) return content; 
            
            
            // Get a path set for literal
            var itemInfoJSON = this.ASSETS.pathsForLiteral( literal , !baseURL ? this.url : baseURL, baseURL!=null, type==2?2:false);
            var itemInfo = itemInfoJSON ? JSON.parse(itemInfoJSON) : null;
            if (!itemInfo) return content;
            
            
            // -- Replace literals with absolutes
            
            // dupes should be detected on a specific content basis, not across all files
            // we removed the need for this.dupeCheckLiteral[contentId] because only one thread is ever processing a specific file
            
            if ( !this.dupeCheckLiteral[ itemInfo.literal] ) {
             
                // Replace instances of literal in markup with relative paths
                content = content.replace( itemInfo.literal , itemInfo.assetRelativePath);
                
                // Add to dupe array
                this.dupeCheckLiteral[ itemInfo.literal ] = true;
                    
            }
                     
            this.returnToMain( {selector:'requestAsset', itemInfo:itemInfo, type:type} );
        
        } catch(e) { this.error(e); }
            
        return content;
        
    },
    
    error : function(e)
    {
        if (Components)
            Components.utils.reportError(e);
        else
            dump("ERROR "+e);
    },
    
    returnToMain : function(data)
    {
        if (!data.selector)
            data.selector = this.selector;
            
        postMessage( data );
    }
};

var process;

onmessage = function(event)
{
    process = new processor(event.data);
    process.JSON = JSON;
    process.init();
    process.run();
    
};