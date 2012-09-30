/*global console, Ext */
Ext.define('BuildDialog', {
    extend: 'Rally.ui.dialog.Dialog',
    alias: 'widget.pxsbuilddialog',   
    width: 300,
    padding: '5px',
    items: [{
        xtype: 'panel',
        layout: { type: 'vbox' },
        itemId: 'build_dialog',
        height: 300,
        defaults: {
            padding: 5
        },
        items: [{
            xtype: 'container',
            itemId: 'date_range',
            height: 100,
            items: [{
                xtype: 'component',
                renderTpl: "<strong>Date Range:</strong>"
            },
            {
                xtype: 'container',
                itemId: 'build_dates'
            },
            {
                xtype: 'component',
                renderTpl: "<strong>Message Contains Text:</strong>"
            },
            {
                xtype: 'container',
                itemId: 'build_text'
            },
            { 
                xtype: 'component',
                renderTpl: '<strong>Builds:</strong>'
            },
            {
                xtype: 'container',
                itemId: 'build_selector'
            }
            ]
        
        }]
    }],
    constructor: function( cfg ) {
        this.callParent(arguments);
        this.initConfig(cfg);
    },
    initComponent: function() {
        this.callParent(arguments);
        this.addEvents(
                /**
                 * @event settingsChosen
                 * Fires when user clicks OK after modifying settings
                 * @param {Hash} checkbox_settings
                 */
                'buildChosen'
        );
        
        this.selected_build = null;
        
        this._placeDateRange();
        this._placeTextSearch();
        this._getBuilds();
        
        this._placeButtons();
    },
    _getFilter: function() {
        console.log( '_getFilter' );
   
        var build_start = Rally.util.DateTime.toIsoString( this.start_date_picker.getValue(), false);
        var build_end = Rally.util.DateTime.toIsoString( Rally.util.DateTime.add( this.end_date_picker.getValue(), "day", 1 ), false);
        var build_message = this.text_picker.getValue();
        
        console.log( "start,end,message", build_start, build_end, build_message );
        
        var query = Ext.create('Rally.data.QueryFilter', {
            property: 'CreationDate',
            operator: '>=',
            value: build_start
        } );
        
        query = query.and( Ext.create( 'Rally.data.QueryFilter', {
                property: 'CreationDate',
                operator: '<=',
                value: build_end
        }) );
        
        if ( build_message && build_message.trim !== "" ) {
            query = query.and( Ext.create( 'Rally.data.QueryFilter', {
                property: 'Message',
                operator: 'contains',
                value: build_message
            }) );
            
        }
        return query;
    },
    _getBuilds: function() {
        console.log( '_getBuilds');
        
        if ( this.dialogBuildSelector ) { this.dialogBuildSelector.destroy(); }
        
        var filter = this._getFilter();
        
        this.buildStore = Ext.create('Rally.data.WsapiDataStore', {
            model: 'Build',
            autoLoad: true,
            fetch: ['Revision','Number','Changesets','Message','Status','CreationDate','Duration','Changes','Extension','Base'],
            sorters: [{
                property: 'CreationDate',
                direction: 'DESC'
              }],
            filters: filter,
            listeners: {
                load: this._addBuildSelector,
                scope: this
            } 
        });
        
    },
    _addBuildSelector: function(store, data){
        console.log( '_addBuildSelector');

        var dialog_builds = [];
        
        var i=0;
        Ext.Array.each(data, function(record) {     
            i++;
            var item = record.data;
            var change_array = [];

            dialog_builds.push({
                Duration: item.Duration,
                Message: item.Message,
                Status: item.Status,
                CreationDate: item.CreationDate,
                Changesets: item.Changesets,
                Number: item.Number,
                ObjectID: item.ObjectID
            });
        });    
        
        Ext.define( 'ChangeModel', {
            extend: 'Ext.data.Model',
            fields: [ 
                { name: 'Base', type: 'string' },
                { name: 'Extension', type: 'string' }
            ]      
        } );
        
        Ext.define('ChangeSetModel', {
            extend: 'Ext.data.Model',
            hasMany: { model: 'ChangeModel', name: 'Changes' },
            fields: [ 
                { name: 'Message', type: 'string' },
                { name: 'Revision', type: 'string' }
            ]          
        });
        
        Ext.define('DialogBuildsModel', {
                extend: 'Ext.data.Model',
                hasMany: { model: 'ChangeSetModel', name: 'Changesets' },
                fields: [
                    { name: 'Duration', type: 'string' }, 
                    { name: 'Message', type: 'string' }, 
                    { name: 'Status', type: 'string' }, 
                    { name: 'CreationDate', type: 'string' }, 
                    { name: 'Number', type: 'string' }, 
                    { name: 'ObjectID', type: 'string' }
                ]        
            });
        
        var buildStore = Ext.create('Rally.data.custom.Store', {
            model: 'DialogBuildsModel',
            data: dialog_builds,
            pageSize: 500
        });
        // switched to Ext combobox to get the typeahead limiting of the list
        if ( this.dialogBuildSelector ) { this.dialogBuildSelector.destroy(); this.selected_build = null;}

        this.dialogBuildSelector = Ext.create( 'Ext.form.ComboBox', {
            displayField: 'Number',
            store: buildStore,
            width: 250,
            queryMode: 'local',
            listeners: {
                scope: this,
                select: function(combo, records, eOpts){
                    this.selected_build = records[0].data;
                    console.log("selected build", this.selected_build );
                }
            }
            
        });
        
        this.down("#build_selector").add(this.dialogBuildSelector);
    },
    _placeTextSearch: function() {
        this.text_picker = Ext.create( Rally.ui.TextField, {
            width: 250,
            listeners: {
                change: this._getBuilds,
                scope: this
            }
        } );
        this.down('#build_text').add(this.text_picker);
    },
    _placeDateRange: function() {
        this.start_date_picker = Ext.create( Rally.ui.DateField,{
            fieldLabel: 'Start Date',
            value: Rally.util.DateTime.add( new Date(), "month", -1 ),
            listeners: {
                change: this._getBuilds,
                scope: this
            }
        });
        
        this.end_date_picker = Ext.create( Rally.ui.DateField,{
            fieldLabel: 'End Date',
            value: new Date(),
            listeners: {
                change: this._getBuilds,
                scope: this
            }
        });
        
        this.down('#build_dates').add(this.start_date_picker);
        this.down('#build_dates').add(this.end_date_picker);
    },
    
    _placeButtons: function() {
        this.down('#build_dialog').addDocked({
            xtype: 'toolbar',
            dock: 'bottom',
            padding: '0 0 10 0',
            layout: {
                pack: 'center'
            },
            ui: 'footer',
            items: [
                {
                    xtype: 'rallybutton',
                    text: "OK",
                    scope: this,
                    userAction: 'clicked done in dialog',
                    handler: function() {
                        var build = this.selected_build;
                        this.fireEvent('buildChosen', {
                            build: build
                        });
                        this.close();
                    }
                },
                {
                    xtype: 'component',
                    itemId: 'cancelLink',
                    renderTpl: '<a href="#" class="dialog-cancel-link">Cancel</a>',
                    renderSelectors: {
                        cancelLink: 'a'
                    },
                    listeners: {
                        click: {
                            element: 'cancelLink',
                            fn: function(){
                                this.close();
                            },
                            stopEvent: true
                        },
                        scope: this
                    }
                }
            ]
        });
    }
});
