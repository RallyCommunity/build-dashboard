/*global console, Ext */
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    items: [
            { 
                xtype: 'container',
                itemId: 'big_box',
                cls: "box",
                height: "100%",
                padding: 5,
                // hacks for scrolling:
                scroll: false, 
                style: { overflow: 'auto', overflowX: 'hidden' },
                items: [ { xtype: 'container', itemId: 'message_box', width: 200 }, 
                         { xtype: 'container', itemId: 'button_box', width: 200 },
                         { xtype: 'container', itemId: 'interface_box', cls: "box"},
                         { xtype: 'container', itemId: 'build_results'},
                         { 
                             xtype: 'container',
                             flex: 1,
                             items: [{
                                 xtype: 'component',
                                 padding: 5,
                                 html: 'Click on Message to preview files affected'
                             },{ 
                             xtype: 'container', 
                             itemId: 'change_results',
                             height: "33%",
                             padding: 5,
                             // hacks for scrolling:
                             scroll: false, 
                             style: { overflow: 'auto', overflowX: 'hidden' } 
                             }] 
                         },
                         {
                            xtype: 'container',
                            flex: 1,
                            items: [{
                                xtype: 'component',
                                padding: 5,
                                html: 'Click on Test Case Name to preview notes.' 
                            },
                            { 
                                 xtype: 'container', 
                                 itemId: 'test_results',
                                 height: "33%",
                                 padding: 5,
                                 // hacks for scrolling
                                 scroll: false, 
                                 style: { overflow: 'auto', overflowX: 'hidden' } 
                            }]
                         }
                ]
            }
    ],
    launch: function() {
        this._saySomething("Looking for most recent build..." );
        this._getBuild();
    },
    _saySomething: function( message ) {
        this.down("#message_box").update(message);
    },
    _getBuild: function() {
         Ext.create('Rally.data.WsapiDataStore', {
            model: 'Build',
            autoLoad: true,
            pageSize: 1,
            fetch: ['Revision','Number','Changesets','Message','Status','CreationDate','Duration','Changes','Base','Extension'],
            sorters: [{
                property: 'CreationDate',
                direction: 'DESC'
              }],
            listeners: {
                load: function(store, data){
                    console.log(data);
                    this._buildResults(data[0].data);
                    this._testResults( data[0].data.Number);
                    this._saySomething("" );
                    this.down('#button_box').add({
                            xtype: 'rallybutton',
                            text: 'Select Build',
                            height: 25,
                            handler: function() {
                                Ext.create( 'BuildDialog', {
                                    autoShow: true,
                                    draggable: true,
                                    title: 'Find Build',
                                    listeners: {
                                        buildChosen: {
                                            scope: this,
                                            fn: function( settings ) {
                                                console.log( "buildChosen:", settings.build );
                                                if ( settings.build && settings.build !== null ) {
                                                    // TODO: is there an easier way to get the grandparent?   
                                                    this.ownerCt.ownerCt.ownerCt._buildResults(settings.build);
                                                    this.ownerCt.ownerCt.ownerCt._testResults( settings.build.Number);
                                                    //this.ownerCt.ownerCt._buildResults(settings.build);
                                                    //this.ownerCt.ownerCt._testResults( settings.build.Number);
                                                }
                                            }
                                        }
                                    }
                                } );
                            }
                        });
                },
                scope: this
            }
            
        });
    },
    _onChangeSetsLoaded: function(changesets){
            console.log("_onChangeSetsLoaded: ", changesets);    
            var cs_records = [];  
            
            Ext.Array.each(changesets, function(record) { 
                var cs_record = {
                    Revision: record.Revision,
                    Message: record.Message,
                    ChangeText: record.ChangeText
                };
                var change_array = [];
                Ext.Array.each( record.Changes, function(change) {
                    change_array.push( change.Base + "." + change.Extension );
                });
                if ( change_array.length > 0 ) {
                    cs_record.ChangeText = change_array.join(", " );
                }
                cs_records.push(cs_record);                   
            });    
            
            Ext.define('ChangeSetModel', {
                extend: 'Ext.data.Model',
                fields: [
                {name: 'Revision', type: 'string'},
                {name: 'Message', type: 'string'},
                { name: 'ChangeText', type: 'string' }
                ]        
            });
            
            var changeStore = Ext.create('Rally.data.custom.Store', {
                        model: 'ChangeSetModel',
                        pageSize: 5,
                        data: cs_records
                    });
   
            if ( this.cr_grid ) { this.cr_grid.destroy(); }
            
            this.cr_grid = this.down('#change_results').add({
                xtype: 'rallygrid',
                store: changeStore,
                width: "97%",
                showPagingToolbar: true,
                pagingToolbarCfg: {
                    autoScroll: true,
                    pageSizes: [5, 25, 50, 100, 200]
                },
                listeners: {
                    itemclick: function( grid, record, item, index ) {
                        Ext.Msg.show( {
                            title: 'Files Changed',
                            msg: record.data.ChangeText,
                            width: 200,
                            buttons: Ext.MessageBox.OK
                        });
                    }
                },
                columnCfgs: [
                    {
                        text: 'Revision', dataIndex: 'Revision' 
                    },
                    {
                        text: 'Message', dataIndex: 'Message', flex: 1
                    }
                ]
            });
    },
    
    _changeSets: function(build){        
        //console.log("Number of changes: ", build.Changesets.length);
        if(build.Changesets !== null){
            console.log('changesets:', build.Changesets);
            this._onChangeSetsLoaded( build.Changesets );
        }else{
            console.log("No changesets for build");
        }
    },
    
    _buildResults: function(build){
        console.log(build);
        var t = new Ext.Template('<b>Build Number:</b> {Number} <br/>' +
                                 '<b>Build Status:</b> {Status} <br/>',
                                 '<b>Date:</b> {CreationDate} <br/>',
                                 '<b>Duration:</b> {Duration} <br/><br/>', 
                                 '<b>Notes:</b><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {Message} <br/><br/><br/>'
                                 );
        //Hack - Build objects don't have duration yet
        if(build.Duration === null){
            build.Duration = "45.2 min";
        }
        
        var buildResultHTML = t.applyTemplate(build);
        
        this.down('#build_results').update({
            xtype: 'component',
            html: buildResultHTML
        });
        this._changeSets(build);
    },
    
    _onTestResultLoaded: function(store, data){
        console.log( "_onTestResultLoaded", store, data );
        var records = [];
        
        Ext.Array.each(data, function(record) {        
            var item = record.data;
            records.push({
                FormattedID: item.TestCase.FormattedID,
                TestName: item.TestCase.Name,
                ObjectID: item.TestCase.ObjectID,
                TestDuration: item.Duration,
                Verdict: item.Verdict,
                Notes: item.Notes,
                _type: "testcase"
            });
        });    
        
        Ext.define('ResultsModel', {
            extend: 'Ext.data.Model',
            fields: [
                {name: 'ObjectID', type: 'string' },
                {name: 'FormattedID', type: 'string'},
                {name: 'TestName', type: 'string'},
                {name: 'TestDuration', type: 'string'},
                {name: 'Verdict', type: 'string'},
                {name: 'Notes', type: 'string' },
                {name: '_type', type: 'string'}
            ]        
        });
        
        this.resultsStore = Ext.create('Rally.data.custom.Store', {
            model: 'ResultsModel',
            pageSize: 5,
            data: records
        });
        
        if ( this.tr_grid ) { this.tr_grid.destroy(); }
        this.tr_grid = this.down('#test_results').add({
            xtype: 'rallygrid',
            width: "97%",
            store: this.resultsStore,
            viewConfig: {
                stripeRows: true,
                emptyText: "No test cases run"
            },
            showPagingToolbar: true,
            pagingToolbarCfg: {
                autoScroll: true,
                pageSizes: [5, 25, 50, 100, 200]
            },
            listeners: {
                itemclick: function( grid, record, item, index ) {
                    console.log( "item", record, item, index );
                    Ext.Msg.alert('Notes', record.data.Notes );
                }
            },
            columnCfgs: [
                {
                    text: 'TestCase', dataIndex: 'FormattedID', width: 65,
                    renderer: function(value,style,row_data, row_index){
                        console.log(style,row_data, row_index);
                        console.log( Rally.util.Navigation.createReallyDetailUrl );
                        return Ext.String.format("<a target='_top' href='/slm/detail/tc/{1}'>{0}</a>", value, row_data.data.ObjectID);
                    }
                },
                {
                    text: 'Test Name', dataIndex: 'TestName', flex: 1
                },
                {
                    text: 'Run Time (s)', dataIndex: 'TestDuration', width: 75
                },                        
                {
                    text: 'Verdict', dataIndex: 'Verdict', width: 95, 
                    renderer: function(value){
                        if((value === "Fail") || (value === "Error") || (value === "Blocked")){
                            return Ext.String.format("<div style='background-color:#F00;color:#FFF;font-weight:bold;text-align:center;padding: 3px'>{0}</div>", value);
                        } else if ( value === "Inconclusive" ) {
                            return Ext.String.format("<div style='background-color:#ccc;color:#000;font-weight:bold;text-align:center;padding: 3px'>{0}</div>", value);
                        }else{
                            return Ext.String.format("<div style='background-color:#2EFE2E;color:#000;font-weight:bold;text-align:center;padding: 3px'>{0}</div>", value);
                        }
                    }
                }
    
            ]
        });
    
    },
    
    _testResults: function(buildId){
        console.log("Test results for: " + buildId);
        //Query all TestCaseResults objects in context with Build = buildId
        
        Ext.create('Rally.data.WsapiDataStore', {
                        model: 'TestCaseResult',
                        fetch: ['ObjectID','Build', 'Duration', 'Verdict', 'TestCase', 'FormattedID', 'Name', 'Notes', 'Date'],
                        sorters: [
                                  {
                                      property: 'Date',
                                      direction: 'DESC'
                                  }
                        ],
                        autoLoad: true,
                        listeners: {
                            load: this._onTestResultLoaded,
                            scope: this
                        },
                        filters: [
                            { property: 'Build', 
                              operator: "=",
                              value: buildId
                            }
                        ]
                    });
        
    }
});


