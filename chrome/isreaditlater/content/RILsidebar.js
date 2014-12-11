function RILsidebar() {
}

RILsidebar.prototype = {	

	_init : function(mainWindow) {
		
		try {
		
		this.w = mainWindow;
		
		document.getElementById('RIL_sidebar_wrapper').appendChild( document.getElementById('RIL_list_inner') );
		document.getElementById('RIL_list').setAttribute('id', '');
		document.getElementById('RIL_sidebar_wrapper').setAttribute('id', 'RIL_list');	
		
		this.loadScript('RIL');
		this.loadScript('RILshare');
		
		RIL.init();
		
		}catch(e) { Components.utils.reportError(e); }
	},
	
	init : function() {
		try {
		RIL.openReadingList();
		} catch(e) { Components.utils.reportError(e); }
	},
	
	loadScript : function(jsFile) {
		
		Components.classes["@mozilla.org/moz/jssubscript-loader;1"]
			  .getService(Components.interfaces.mozIJSSubScriptLoader)
			  .loadSubScript("chrome://isreaditlater/content/"+jsFile+".js"); 
		
	},
			
}

var RILsidebar = new RILsidebar();

window.addEventListener("load", function() { RILsidebar.init(); }, false);