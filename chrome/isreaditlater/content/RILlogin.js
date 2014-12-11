function RILlogin() {
        this.showPanel('choice');
}
RILlogin.prototype = {
        
        showPanel : function(panel)
        {
                if (this.currentPanel)
                        RIL.xul('login_panel_'+this.currentPanel).hidden = true;
                
                this.currentPanel = panel;
                RIL.xul('login_panel_'+this.currentPanel).hidden = false;
        },
        
        checkEnterKey : function()
        {
                if (this.currentPanel == 'login')
                        this.login();
                else if (this.currentPanel == 'signup')
                        this.signup();
        },
        
        login : function()
        {
                var username = RIL.xul('login_username').value;
                var password = RIL.xul('login_password').value;					
                
                if (username.length == 0 || password.length == 0)
                {
                        RIL.APP.PROMPT.alert(window, 'Pocket', RIL.l('mustEnterUserAndPass') );
                        return false;
                }
                
                RIL.addClass( RIL.xul('login') , RIL.XULnamespace + 'loading' );
                RIL.APP.SYNC.login(username, password, this, 'loginCallback');			
        },

        loginCallback : function(request) {
                        
                RIL.removeClass( RIL.xul('login') , RIL.XULnamespace + 'loading' );
                
                try {
                        
                if (request.success)
                {
                        this.saveLogin('login');
                        
                        // Sync and show list
                        try {
                                
                                var w = this.getTopWindow();	
                                
                                w.RIL.openListAfterLogin();
                                
                                window.close();
                                
                        } catch(e) {
                                // if we can't connect to the current window, just give up and close the login dialog
                                window.close();
                        }

                }
                else
                {
                        this.handleError(request, 'logging in');
                }
                
                } catch(e) { Components.utils.reportError(e); }
        },
        
        signup : function()
        {
                var username 			= RIL.xul('signup_username').value;
                var password 			= RIL.xul('signup_password').value;	
                var email 			= RIL.xul('signup_email').value;					
                
                if (username.length == 0 || password.length == 0)
                {
                        RIL.APP.PROMPT.alert(window, 'Pocket', RIL.l('mustEnterUserAndPass') );
                        return false;
                }
                                
                
                RIL.addClass( RIL.xul('login') , RIL.XULnamespace + 'loading' );
                RIL.APP.SYNC.signup(username, password, email, this, 'signupCallback');			
        },

        signupCallback : function(request)
        {                
                RIL.removeClass( RIL.xul('login') , RIL.XULnamespace + 'loading' );
                
                if (request.success)
                {
                        this.saveLogin('signup');
                        
                        // Sync and show list
                        try {
                                
                                var w = this.getTopWindow();	
                                
                                w.RIL.openListAfterLogin();
                                
                                window.close();
                                
                        } catch(e) {
                                // if we can't connect to the current window, just give up and close the login dialog
                                window.close();
                        }

                }
                else
                {
                        this.handleError(request, 'logging in');
                }
        },

        noAccount : function(request)
        {                
                var w = this.getTopWindow();	
                
                w.RIL.openListAfterLogin();
                
                window.close();
        },
        
        saveLogin : function(which)
        {
                RIL.APP.saveLogin( RIL.xul(which+'_username').value , RIL.xul(which+'_password').value);
        },
        
        handleError : function(request, action)
        {
                var check = {value: false};
                var flags = RIL.APP.PROMPT.BUTTON_POS_0 * RIL.APP.PROMPT.BUTTON_TITLE_OK +
                                        RIL.APP.PROMPT.BUTTON_POS_1 * RIL.APP.PROMPT.BUTTON_TITLE_IS_STRING;


                var button = RIL.APP.PROMPT.confirmEx(window, "Pocket",
                                        "There was a problem "+action+":\n\n"+request.error,
                                        flags, 
                                         "", "Get Help", "",
                                         null, check
                );
                
                if (button == 1)
                        window.open('http://readitlaterlist.com/support/');
                        
        },
        
        getTopWindow : function()
        {
                var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
                                .getService(Components.interfaces.nsIWindowMediator);
                var w = wm.getMostRecentWindow("navigator:browser");

                return w ? w : window.opener;
        }
        
}
RILlogin = new RILlogin();