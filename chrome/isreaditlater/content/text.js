// Functions

function $(id){return document.getElementById(id);}

function showSettings() {
	
	var s = $('RIL_settings_wrapper');
	if (s.innerHTML.length < 5) {
		s.innerHTML = '\
			<h4>Settings:</h4>\
			<p>\
				<strong>Light:</strong>\
				<a id="sL0">Day</a>\
				<a id="sL1">Night</a>\
			</p>\
			<p>\
				<strong>Font Size:</strong>\
				<a id="sS0">Small</a>\
				<a id="sS1">Medium</a>\
				<a id="sS2">Large</a>\
			</p>\
			<p>\
				<strong>Font:</strong>\
				<a id="sF0">Sans-Serif</a>\
				<a id="sF1">Serif</a>\
			</p>\
		' + (screen.availWidth > 320 ? '\
			<p>\
				<strong>Margin:</strong>\
				<a id="sM0">Small</a>\
				<a id="sM1">Medium</a>\
				<a id="sM2">Large</a>\
				<a id="sM3">Larger</a>\
			</p>\
			' : '' ) + '\
			<p>\
				<strong>Align:</strong>\
				<a id="sA0">Left</a>\
				<a id="sA1">Justify</a>\
			</p>\
			';
		
		var p;
		var as = s.getElementsByTagName('a');
		for(var i=0; i<as.length; i++) {
			p = pa(as[i]);
			if ( o[p[0]] == p[1] ) { as[i].className = 'selected'; }
			as[i].onclick = set;			
		}
	} else {			
		s.style.display = s.style.display == 'none' ? 'block' : 'none' ;			
	}
	
}	

function set(e) {	
    var p = pa(this);
    $('s' + p[0] + o[p[0]]).className = '';
    document.body.className = document.body.className.replace(p[0] + o[p[0]], p[0]+p[1]);	
    
    $('s' + p[0] + p[1]).className = 'selected';
            
    o[p[0]] = p[1];
    
    saveSettings();
}

function pa(el) {
    el.id.match(/s([A-Z])([0-9])/);
    return [RegExp.$1,RegExp.$2];		
}

function settingsLoaded(event)
{
    o = JSON.parse( document.body.getAttribute('o') );
    var str = '';
    var i;
    for(i in o)
    {
        str += ' '+i+o[i];
    }
    document.body.className = str;
}

function saveSettings()
{
    document.body.setAttribute('o', JSON.stringify(o));
    
    var evt = document.createEvent("Events");
    evt.initEvent("settingschanged", true, false);
    document.body.dispatchEvent(evt);
}

function showMore()
{	
    document.body.setAttribute('id', 'more');
}

function showLess()
{	
    document.body.setAttribute('id', 'less');
}

// -- Init

var o = {};

// Add events
window.addEventListener("settingsloaded", settingsLoaded, false);

window.onload = function()
{
    $('RIL_settings').onclick = showSettings;
    
    if ($('nav_more'))
    {
	$('nav_more').getElementsByTagName('a')[0].onclick = showMore;
	$('nav_less').getElementsByTagName('a')[0].onclick = showLess;
    
	// look for a bad less section

	if ( $('RIL_less').textContent.length  < 200 ) {
		var p = document.createElement('p');
		p.className = 'note';
		p.innerHTML = 'The text generator could not find much content.  You might have better luck switching to the \'More\' view. </p>';
		$('RIL_less').insertBefore(p,$('RIL_less').firstChild);
	}
	if ( $('RIL_more').textContent.length  < 200 ) {
		var p = document.createElement('p');
		p.className = 'note';
		p.innerHTML = 'The text generator could not find much content.  If you know there should be content here, please help improve the text generator by <a href="http://readitlaterlist.com/support/">reporting this page</a>. </p>';
		$('RIL_more').insertBefore(p,$('RIL_more').firstChild);
	}	
	
	if ( $('RIL_no_less_view_note') )
	{
		showMore();
	}
    }
	// update scheme links
	for(var i in document.links)
	{
		if (document.links[i] && document.links[i].href && document.links[i].href.match('isril:'))
		{
			document.links[i].onclick = document.links[i].href.match(':less') ? showLess : showMore;
			document.links[i].removeAttribute('href');
		}
	}
}


    





