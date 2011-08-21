jQuery(document).ready(function($) {
        // utility function taken from http://stackoverflow.com/questions/4346358/how-to-get-size-of-jquery-object
      function getPropertyCount(obj) {
          var count = 0,
              key;

          for (key in obj) {
              if (obj.hasOwnProperty(key)) {
                  count++;
              }
          }

          return count;
      }

      // create namespace and local functions
      Simfo = {
        dataIsFreshByElt: {},
        editingRowId: null,
        graphing: {
          colors: {
            nodeFillDefault: "#DEEAFE",
            nodeFillHighlight: "#CCCC00",
            edgeLabelStrokeDefault: null,
            edgeLabelStrokeHighlight: "#AAAA00",
            edgeLineStrokeDefault: "#000",
            edgeLineStrokeHighlight: "CCCC00"
          },
          sizes: {
            nodeDefaultWidth: 45,
            nodeDefaultHeight: 20,
            nodeLabelDefaultFontSize: 10,
            nodeLabelMaxLineSize: 20,
            edgeLabelDefaultFontSize: 10
          },
          zoomFactor: 1.0,
          defaultNumRelationships: 11,
          showCategoryNode: true
        },
        pendingAddRowData: [],
        selectedEntityName: null,
        selectedRowId: null,

        renderGraph: function() {
          var height = 320;
          var width = 640;

          // Custom render function to draw graph nodes as ellipses
          var render = function(r, n) {
            var nodeWidth = Simfo.graphing.sizes.nodeDefaultWidth * Simfo.graphing.zoomFactor;
            var nodeHeight = Simfo.graphing.sizes.nodeDefaultHeight * Simfo.graphing.zoomFactor;
            var nodeFontSize = Simfo.graphing.sizes.nodeLabelDefaultFontSize * Simfo.graphing.zoomFactor;
            var nodeLabel = $.trim(n.label || n.id || "");

            if (nodeLabel && nodeLabel.length > Simfo.graphing.sizes.nodeLabelMaxLineSize) {
              if (nodeLabel.indexOf(' ') != -1) {
                words = nodeLabel.split(/\s/);
                lines = [];
                while (words.length > 0) {
                  var nextWord = words.shift();
                  var combinedLine = (lines.length == 0 ? null : lines[lines.length-1] + ' ' + nextWord);
                  if (lines.length > 0 && combinedLine.length <= Simfo.graphing.sizes.nodeLabelMaxLineSize) {
                    lines.pop();
                    lines.push(combinedLine);
                  }
                  else {
                    lines.push(nextWord);
                  }
                }
                nodeLabel = lines.join("\n");
              }
              else {
                nodeLabel = ( nodeLabel.substr(0, Simfo.graphing.sizes.nodeLabelMaxLineSize - 1) +
                              "-" + nodeLabel.substr(Simfo.graphing.sizes.nodeLabelMaxLineSize) );
              }
            }

            /* the Raphael set is obligatory, containing all you want to display */
            var set = r.set().push(
              /* custom objects go here */
              r.ellipse( n.point[0], n.point[1], nodeWidth, nodeHeight).attr({
                "fill" : "#CCDDFF", /* NOTE: dracula_graph.js:214 sets opacity to 0.6, making this #E0EBFF */
                "stroke-width" : "1px"
                })).push(r.text(n.point[0], n.point[1], nodeLabel)).attr({"font-size": nodeFontSize});
            return set;
          };

          // Custom label function to draw graph edges with smaller text
          var createEdgeLabel = function(text) {
            var fontSize = Simfo.graphing.sizes.edgeLabelDefaultFontSize * Simfo.graphing.zoomFactor;
            return {weight:9, directed: true, stroke: "#000", label: text, "label-style": { "font-size" : fontSize }};
          };

          var g = Simfo.graphing.graph || new Graph();

          // Function to complete layout after nodes and edges are generated
          var completeLayout = function(g, edgesByRelationshipId) {
            // Layout the graph using the Spring layout implementation
            var layouter = new Graph.Layout.Spring(g);
            layouter.layout();

            // Draw the graph using the RaphaelJS draw implementation
            var renderer = Simfo.graphing.renderer || new Graph.Renderer.Raphael('canvas-graph', g, width, height);
            renderer.draw();

            // Save references so that we can clear the graph
            Simfo.graphing.graph = g;
            Simfo.graphing.renderer = renderer;
            Simfo.graphing.edgesByRelationshipId = edgesByRelationshipId;

            // Force highlighting of selected relationship or entity, if any
            var rowId = Simfo.selectedRowId;
            var entityName = Simfo.selectedEntityName;
            Simfo.selectedRowId = null;
            Simfo.selectedEntityName = null;
            if ( entityName ) { Simfo.onSelectEntity(entityName); }
            if ( rowId ) { Simfo.onSelectRow(rowId); }

            // Setup click events for Entity selection
            $.each(g.nodes, function(idx, node) {
              node.shape.click(function(event) {
                Simfo.selectEntityName(node.id);
                return true;
              });
            });

            // Setup click events for Relationship selection
            $.each(g.edges, function(idx, edge) {
              edge.connection.fg.click(function(event) {
                Simfo.selectRowId(edge.relationshipId, true);
                return true;
              });
              edge.connection.label.click(function(event) {
                Simfo.selectRowId(edge.relationshipId, true);
                return true;
              });
            });
          };

          // Current search filters
          var searchOpts = $.extend(true, {}, $("#tbl-relations").jqGrid('getGridParam', 'postData') );
          searchOpts._search = "true";

          // Paginate based on zoom
          var rowsZoomFactor = 1.0 / (Simfo.graphing.zoomFactor * Simfo.graphing.zoomFactor);
          searchOpts.rows = Math.floor( (searchOpts.rows || Simfo.graphing.defaultNumRelationships) * rowsZoomFactor );

          // Ensure selected row is shown
          if ( Simfo.selectedRowId ) { searchOpts.must_show_id = Simfo.selectedRowId; }

          // Create edges
          var edgesByRelationshipId = {};
          Simfo.getRelationships(searchOpts, function(rels) {
            $.each(rels, function(idx, rel) {
              if ( Simfo.graphing.showCategoryNode ||
                   (rel.from_entity__name != 'Category' && rel.to_entity__name != 'Category' ) ) {
                g.addNode(rel.from_entity__name, { render: render });
                g.addNode(rel.to_entity__name, { render: render });
                g.addEdge(rel.from_entity__name, rel.to_entity__name, createEdgeLabel(rel.relationship_type__name));

                // store a reference to each edge by the relationship id
                var edge = g.edges[g.edges.length - 1];
                edgesByRelationshipId[rel.id] = edge;
                edge.relationshipId = rel.id;
              }
            });

            // Complete the layout and render
            completeLayout(g, edgesByRelationshipId);
          });
        },

        addCategory: function(singular, plural, callback) {
          $.create('/categories',
            { 'category': { 'entity': { 'name': singular },
                            'pluralized_name': plural } },
            function(response) {
              callback();
            },
            function(response) {
              var jsonData = $.parseJSON(response.responseText);
              var jsonCopy = $.extend(true, {}, jsonData);
              if ( jsonCopy.entity_id == 'has already been taken' ) { delete jsonCopy.entity_id; }
              if ( jsonCopy.pluralized_name == 'has already been taken' ) { delete jsonCopy.pluralized_name; }
              if ( getPropertyCount(jsonCopy) == 0 ) {
                // there aren't any other errors -- so this category already existed -- so do callback
                callback();
              }
              // there were other errors, don't know how to handle, so stop here
            });
        },

        addRelationTriple: function() {
          if ( Simfo.areAllComboboxesFilled() ) {
            var data = $('#from-entity, #relation, #to-entity').map(function() {
              return $.trim( $(this).next('.ui-combobox').val() );
            });
            Simfo.addRow({
              relationship: {
                "from_entity__name": data[0],
                "relationship_type__name": data[1],
                "to_entity__name": data[2]
              }
            });
          }
        },

        addReverseOfSelected: function() {
          var rowId = $( "#tbl-relations" ).jqGrid( 'getGridParam', 'selrow' );
          if ( !rowId ) { return false; }
          var rowData = Simfo.getRow( rowId );
          var reverseRow = { relationship: {
            "from_entity__name": rowData.to_entity__name,
            "relationship_type__name": rowData.relationship_type__name,
            "to_entity__name": rowData.from_entity__name
          } };
          Simfo.addRow( reverseRow );
        },

        addRow: function(rowData) {
          $('.btn-disabled-unless-new-data-entered').button( "option", "disabled", true );

          var updateRowId = rowData.relationship.updateRowId;
          var baseUrl = '/relationships';
          var ajaxUrl = (updateRowId ? (baseUrl + '/' + updateRowId) : baseUrl);
          var ajaxFunction = (updateRowId ? $.update : $.create);
          var ajaxRowData = $.extend(true, {}, rowData); // deep copy
          if ( updateRowId ) { delete ajaxRowData.relationship.updateRowId; }

          ajaxFunction(ajaxUrl,
            ajaxRowData,
            function(response) {
              Simfo.addRowCompleted(false);
            },
            function(response) {
              // create request failed
              var jsonData = $.parseJSON(response.responseText);
              if ( jsonData['relationship_type_id'] == 'has already been taken' ) {
                // duplicate relationship, stop here
                alert("This relationship already exists in Simfo.");
                Simfo.addRowCompleted(true);
              }
              else if ( jsonData['from_entity'] == 'is not a category' ) {
                // pluralize via web service, and open create category form
                Simfo.pendingAddRowData.push(rowData);
                Simfo.pluralize(rowData.relationship.from_entity__name, function(singular, plural) {
                  Simfo.dlgGetCategoryNames(singular, plural);
                });
              }
              else if ( jsonData['to_entity'] == 'is not a category' ) {
                // pluralize via web service, and open create category form
                Simfo.pendingAddRowData.push(rowData);
                Simfo.addRow({ relationship: {
                  from_entity__name: rowData.relationship.to_entity__name,
                  relationship_type__name: rowData.relationship.relationship_type__name,
                  to_entity__name: 'Category'
                } });
              }
            });
        },

        addRowCompleted: function(cancelled) {
          if ( !cancelled ) {
            if ( Simfo.pendingAddRowData.length > 0 ) {
              Simfo.addRow( Simfo.pendingAddRowData.pop() );
            }
            else {
              Simfo.clearComboboxes();
              $("#tbl-relations").trigger("reloadGrid");
              Simfo.updateGraph();
            }
          }
          else {
            Simfo.pendingAddRowData = [];
          }
        },

        areAllComboboxesFilled: function() {
          var valuesPresent = $( '#from-entity, #relation, #to-entity' ).map(function() {
            return ( $.trim( $( this ).next( '.ui-combobox' ).val() ) != '' );
          });
          var allValuesPresent = ( $.inArray( false, valuesPresent ) == -1 );
          return allValuesPresent;
        },

        clearComboboxes: function() {
          $('#from-entity, #relation, #to-entity').each(function() {
            $( this ).next('.ui-combobox').val( '' );
            $( this ).val( '' );
          });
        },

        clearEditingRow: function() {
          $("#tbl-relations").jqGrid('restoreRow', Simfo.editingRowId);
          Simfo.editingRowId = null;
        },

        clearGraph: function() {
          // clear Raphael canvas objects
          Simfo.graphing.renderer && Simfo.graphing.renderer.r.clear();

          // clear Dracular graph objects
          Simfo.graphing.graph && (Simfo.graphing.graph.nodes = {});
          Simfo.graphing.graph && (Simfo.graphing.graph.edges = []);
          Simfo.graphing.edgesByRelationshipId = {};
        },

        dataIsStillFresh: function(element, value) {
          if (element === "reset" && value === undefined) {
            Simfo.dataIsFreshByElt = {};
            return null;
          }
          else if (value === undefined) {
            // just return the previously set value
          }
          else if (!value) {
            delete Simfo.dataIsFreshByElt[element[0].id];
          }
          else {
            Simfo.dataIsFreshByElt[element[0].id] = value;
          };
          return Simfo.dataIsFreshByElt[element[0].id];
        },

        deleteRow: function(rowId) {
          if ( !rowId ) { return false; }

          $("#tbl-relations").jqGrid('delGridRow', rowId, {
            closeAfterEdit: true,
            reloadAfterSubmit: true,
            url: '/relationships/' + encodeURIComponent(rowId),
            mtype: "DELETE",
          });
        },

        deleteSelected: function() {
          var rowId = $("#tbl-relations").jqGrid('getGridParam', 'selrow');
          return Simfo.deleteRow(rowId);
        },

        dlgGetCategoryNames: function(singular, plural) {
          $( "#singular" ).val( singular );
          $( "#plural" ).val( plural );
          $( '#dlg-category-form' ).dialog( 'open' );
        },

        filterEntities: function(jsonData, options) {
          var entities = [],
            defaults = {
              includeNonCategories: true,
              includeCategories: false,
              includeMasterCategory: false,
              includeBlank: false,
              useCategoryPlurals: false,
              useCategoryIds: false
            };

          options = $.extend({}, defaults, options);

          if ( options.includeBlank ) { entities.push({ name: " ", id: "" }); }

          $.each(jsonData, function(idx, json) {
            var name = undefined;
            var id = undefined;

            if ("category" in json.entity) {
              if (options.includeCategories) {
                if (options.includeMasterCategory || json.entity.name != 'Category') {
                  name = (options.useCategoryPlurals ? json.entity.category.pluralized_name : json.entity.name);
                  id = (options.useCategoryIds ? json.entity.category.id : json.entity.id)
                }
              }
            } else {
              if (options.includeNonCategories) {
                name = json.entity.name;
                id = json.entity.id;
              }
            }
            if (name) { entities.push({ name: name, id: id }); }
          });

          return entities;
        },

        filterRelations: function(jsonData, options) {
          var relations = [];

          $.each(jsonData, function(idx, json) {
            relations.push({ name: json.relationship_type.name,
                             id: json.relationship_type.id });
          });

          return relations;
        },

        filterRelationships: function(jsonData, options) {
          var relationships = [];

          // wrap in array if returned from #show instead of #index
          if ( !$.isArray(jsonData) && jsonData.relationship ) {
            jsonData = [jsonData];
          }

          $.each(jsonData, function(idx, json) {
            relationships.push({
              from_entity__name: json.relationship.from_entity.name,
              relationship_type__name: json.relationship.relationship_type.name,
              to_entity__name: json.relationship.to_entity.name,
              id: json.relationship.id
            });
          });

          return relationships;
        },

        getCurrentFilterCategoryId: function(select) {
          var filterSelect = $("#" + select[0].id + "-filter");
          if ( filterSelect.next( '.ui-combobox' ).val() != '' ) {
            return filterSelect.val();
          }
          else {
            return null;
          }
        },

        // TODO: DRY overlap between this and UpdateOptionsFromEntities
        getEntities: function(options, callback) {
          $.read('/entities', options, function(jsonData) {
            var entities = Simfo.filterEntities(jsonData, options);
            callback(entities);
          });
        },

        // TODO: DRY overlap between this and jqgrid data retrieval
        getRelationships: function(options, callback) {
          var url = '/relationships';
          if ( options.id ) {
            url = url + '/' + options.id;
            delete options.id;
          }
          $.read(url, options, function(jsonData) {
            var relationships = Simfo.filterRelationships(jsonData, options)
            callback(relationships);
          });
        },

        getRow: function(rowId, canAskServer) {
          if ( !rowId ) { return null; }
          var rowData = $("#tbl-relations").jqGrid('getRowData', rowId);
          if ( (!rowData || !rowData.from_entity__name) && canAskServer ) {
            $.ajaxSetup({
              async: false,
              cache: false,
              timeout: 30000
            });
            Simfo.getRelationships({ id: rowId }, function(rels) {
              $.ajaxSetup({
                async: true,
                cache: null,
                timeout: null
              });
              rowData = rels[0];
            });
          }
          return rowData;
        },

        graphEntityHighlight: function(entityOrName, removeHighlight) {
          var node = (entityOrName && (entityOrName.shape ? entityOrName :
                                       (Simfo.graphing.graph && Simfo.graphing.graph.nodes[entityOrName])));
          if ( !node ) { return; }
          node.shape[0].attr("fill", (removeHighlight ? Simfo.graphing.colors.nodeFillDefault :
                                                        Simfo.graphing.colors.nodeFillHighlight ));
        },

        graphRelationshipHighlight: function(rowId, removeHighlight) {
          if ( !rowId ) { return; }

          var edge = Simfo.graphing.edgesByRelationshipId && Simfo.graphing.edgesByRelationshipId[rowId];
          if ( edge ) {
            edge.connection.label.attr("stroke", (removeHighlight ? Simfo.graphing.colors.edgeLabelStrokeDefault :
                                                                    Simfo.graphing.colors.edgeLabelStrokeHighlight));
            edge.connection.fg.attr("stroke", (removeHighlight ? Simfo.graphing.colors.edgeLineStrokeDefault :
                                                                 Simfo.graphing.colors.edgeLineStrokeHighlight));
            edge.connection.fg.attr("stroke-width", (removeHighlight ? 1 : 3));
            Simfo.graphEntityHighlight(edge.source, removeHighlight);
            Simfo.graphEntityHighlight(edge.target, removeHighlight);
          }
        },

        filterCenteredOnEntities: function(mustShowRowId, entityNames) {
          var postData = $("#tbl-relations").jqGrid('getGridParam', 'postData');
          postData._search = "true";

          var filters = {
            "groupOp": "OR",
            "rules": []
          };

          $.each( entityNames, function(idx, name) {
            filters.rules.push({ field: 'from_entity__name', op: 'eq', data: name });
            filters.rules.push({ field: 'to_entity__name', op: 'eq', data: name });
          });

          postData.filters = JSON.stringify(filters);

          if ( mustShowRowId ) {
            // NOTE (2011-03-30, msiegel):
            // Tell server to give us the page with the desired id
            //
            postData.must_show_id = mustShowRowId;
          }
        },

        navigationFilterOnRelationship: function() {
          if ( !Simfo.selectedRowId ) { return false; }
          var rowData = Simfo.getRow( Simfo.selectedRowId );
          Simfo.filterCenteredOnEntities( Simfo.selectedRowId, [rowData.from_entity__name, rowData.to_entity__name] );
        },

        navigationFilterOnEntity: function() {
          if ( !Simfo.selectedEntityName ) { return false; }
          Simfo.filterCenteredOnEntities( null, [Simfo.selectedEntityName] );
        },

        navigationCenterGraphOrTable: function() {
          if ( Simfo.selectedRowId ) {
            Simfo.navigationFilterOnRelationship();
          }
          else if ( Simfo.selectedEntityName ) {
            Simfo.navigationFilterOnEntity();
          }
          else {
            return;
          }

          var selected = $('#tabs-editor').tabs('option', 'selected');
          if ( selected == 0 ) {
            $('#tabs-editor').tabs("select", "tab-graph");
          }
          else {
            $('#tabs-editor').tabs("select", "tab-table");
          }
        },

        navigationLink: function(direction) {
          if ( !Simfo.selectedRowId && !Simfo.selectedEntityName) { return false; }

          var rowData = ( Simfo.selectedEntityName ? null : Simfo.getRow( Simfo.selectedRowId, true ) );
          var fields = [ "to_entity__name", "from_entity__name" ];
          var data = ( rowData ? ( direction == "left" ? [rowData.from_entity__name] : [rowData.to_entity__name] ) : [Simfo.selectedEntityName] );

          var postData = $("#tbl-relations").jqGrid('getGridParam', 'postData');
          postData._search = "true";

          var filters = ( postData.filters ? $.parseJSON(postData.filters) : {});
          filters.groupOp = 'OR';
          filters.rules = [];
          $.each( data, function(idx, datum) {
            $.each( fields, function(idx, field) {
              filters.rules.push({ field: field, op: 'eq', data: datum });
            });
          });

          postData.filters = JSON.stringify(filters);
          Simfo.selectedEntityName = null;
          Simfo.selectEntityName(data[0]);

          Simfo.updateGraph(null, null);
          Simfo.updateButtonNavCenterGraph(null, null);
        },

        navigationLinkLeft: function() {
          Simfo.navigationLink("left");
        },

        navigationLinkRight: function() {
          Simfo.navigationLink("right");
        },

        onComboboxChange: function(event, ui) {
          var allFilled = Simfo.areAllComboboxesFilled();
          $('.btn-disabled-unless-new-data-entered').button( "option", "disabled", !allFilled );

          if ( event.target.id.indexOf( '-filter' ) > -1 ) {
            var select = $( "#" + event.target.id.replace( '-filter', '' ) );
            Simfo.dataIsStillFresh(select, false);
          }

          return true;
        },

        onComboboxSelect: function(event, ui) {
          if ( ui.item.option.value == "_blank" ) {
            ui.item.value = "";
            $( this ).val( '' );
            return false;
          }
          return true;
        },

        onGridClick: function() {
          var rowId = $("#tbl-relations").jqGrid('getGridParam', 'selrow');
          Simfo.onSelectRow(rowId);
          return true;
        },

        onSelectEntity: function(entityName) {
          if ( entityName == Simfo.selectedEntityName ) { return; }
          var oldEntityName = Simfo.selectedEntityName;
          Simfo.selectedEntityName = entityName;
          if ( entityName ) { Simfo.selectRowId(null); }
          $('.btn-disabled-unless-row-or-entity-selected').button( "option", "disabled", !(entityName || Simfo.selectedRowId) );

          // mark node as selected, if visible in graph
          Simfo.graphEntityHighlight(oldEntityName, true);
          Simfo.graphEntityHighlight(entityName);

          Simfo.updateButtonNavCenterGraph();

          return true;
        },

        onSelectRow: function(rowId) {
          if (rowId && rowId !== Simfo.editingRowId) {
            Simfo.clearEditingRow();
          }

          if ( rowId == Simfo.selectedRowId ) { return; }
          var oldRowId = Simfo.selectedRowId;
          Simfo.selectedRowId = rowId;
          if ( rowId ) { Simfo.onSelectEntity(null); }
          $('.btn-disabled-unless-row-selected').button( "option", "disabled", !rowId );
          $('.btn-disabled-unless-row-or-entity-selected').button( "option", "disabled", !(rowId || Simfo.selectedEntityName) );

          // mark edge as selected, if visible in graph
          Simfo.graphRelationshipHighlight(oldRowId, true);
          Simfo.graphRelationshipHighlight(rowId);

          Simfo.updateButtonNavCenterGraph();

          return true;
        },

        pluralize: function(word, callback) {
          $.read('/pluralize/' + encodeURIComponent(word), {}, function(jsonData) {
            callback(jsonData.singular, jsonData.plural);
          });
        },

        restoreSelectedRow: function() {
          if ( Simfo.selectedRowId != $("#tbl-relations").jqGrid('getGridParam', 'selrow') ) {
            var rowId = Simfo.selectedRowId
            Simfo.selectedRowId = null;
            Simfo.selectRowId( rowId );
          }

          // NOTE (2011-03-30, msiegel): clear this after each grid reload
          var postData = $("#tbl-relations").jqGrid('getGridParam', 'postData');
          if ( postData.must_show_id ) { delete postData.must_show_id; }
        },

        selectEntityName: function(entityName) {
          // selecting the currently selected will de-select it
          if ( entityName == Simfo.selectedEntityName ) { entityName = null; }

          Simfo.onSelectEntity(entityName);
        },

        selectRowId: function(rowId, allowDeselect) {
          // selecting the currently selected will de-select it
          if ( allowDeselect && rowId == Simfo.selectedRowId ) { rowId = null; }

          // set the selected row in the grid
          $( "#tbl-relations" ).jqGrid( 'setSelection', rowId );

          // if that didn't trigger our event, force it manually
          if ( Simfo.selectedRowId != rowId ) {
            Simfo.onSelectRow(rowId);
          }
        },

        updateButtonNavCenterGraph: function(event, ui) {
          var selected = $('#tabs-editor').tabs('option', 'selected');
          var label, target;

          if ( Simfo.selectedRowId ) {
            target = 'Relation';
          }
          else if ( Simfo.selectedEntityName ) {
            target = 'Entity';
          }
          else {
            target = 'Selected';
          }

          if ( selected == 0 ) {
            label = 'View ' + target + ' in Graph';
          }
          else {
            label = 'View ' + target + ' in Table';
          }

          $('#btn-nav-center-graph').button('option', 'label', label);
        },

        updateGraph: function(event, ui) {
          Simfo.clearGraph();
          var selected = $('#tabs-editor').tabs('option', 'selected');
          if ( (ui && ui.index == 1) || selected == 1 ) {
            Simfo.renderGraph($("#tbl-relations").jqGrid('getRowData'));
          }
          else {
            $("#tbl-relations").trigger("reloadGrid");
          }
        },

        updateLinkExportCSV: function() {
          var opt = $.extend(true, {}, $("#tbl-relations").jqGrid('getGridParam', 'postData'));
          delete opt.page;
          delete opt.rows;
          delete opt.jqgrid;
          var url = '/relationships.csv?' + $.param(opt);
          $( '#btn-export-csv' ).attr('href', url);
        },

        updateOptionsFromArray: function(select, array) {
          val = select.val();
          select.find('option').remove().end().append('<option value="_blank">&nbsp;</option>');
          $.each(array, function(idx, entity) {
            select.append('<option value="' + entity['id'] + '">' + entity['name'] + '</option>')
          });
          select.val(val);
          Simfo.dataIsStillFresh(select, true);
        },

        updateOptionsFromEntities: function(request_term, select, callback) {
          if ( Simfo.dataIsStillFresh(select) ) {
            callback();
          }
          else {
            var options = $.extend(true, {}, $("#tbl-relations").jqGrid('getGridParam', 'postData'));
            var catId = Simfo.getCurrentFilterCategoryId(select);
            if ( catId && catId != '_blank' ) { options.category_id = catId; }
            var entitiesOptions = {
              includeNonCategories: $.inArray(select[0].id, ['from-entity', 'to-entity']) >= 0,
              includeCategories: $.inArray(select[0].id, ['to-entity', 'from-entity-filter', 'to-entity-filter']) >= 0,
              includeMasterCategory: $.inArray(select[0].id, ['to-entity', 'to-entity-filter']) >= 0,
              includeBlank: $.inArray(select[0].id, ['from-entity-filter', 'to-entity-filter']) >= 0,
              useCategoryPlurals: $.inArray(select[0].id, ['from-entity-filter', 'to-entity-filter']) >= 0,
              useCategoryIds: $.inArray(select[0].id, ['from-entity-filter', 'to-entity-filter']) >= 0
            };
            options.entitiesOptions = entitiesOptions;
            options.rows = 25;
            $.read('/entities',
                   options,
                   function(jsonData) {
                     var entities = Simfo.filterEntities(jsonData, entitiesOptions);
                     Simfo.updateOptionsFromArray(select, entities);
                     callback();
                   });
          }
        },

        updateOptionsFromRelations: function(request_term, select, callback) {
          if ( Simfo.dataIsStillFresh(select) ) {
            callback();
          }
          else {
            $.read('/relationship_types',
                   $("#tbl-relations").jqGrid('getGridParam', 'postData'),
                   function(jsonData) {
                     var relations = Simfo.filterRelations(jsonData, {});
                      Simfo.updateOptionsFromArray(select, relations);
                      callback();
                   });
          }
        },

        updateRow: function() {
          if ( !Simfo.editingRowId ) { return false; }
          var updateRowId = Simfo.editingRowId;
          var updateRowData = Simfo.getRow( updateRowId );
          Simfo.addRow({
            relationship: {
              "from_entity__name": updateRowData.from_entity__name,
              "relationship_type__name": updateRowData.relationship_type__name,
              "to_entity__name": updateRowData.to_entity__name,
              "updateRowId": updateRowId
            }
          });
          return true
        },

        zoomIn: function() {
          Simfo.graphing.zoomFactor = Math.min(Simfo.graphing.zoomFactor * 1.25, 4.0);
          Simfo.updateGraph(null, null);
        },

        zoomOut: function() {
          Simfo.graphing.zoomFactor = Math.max(Simfo.graphing.zoomFactor * 0.8, 0.25);
          Simfo.updateGraph(null, null);
        }
      };

      // setup various page elements
      $('#tabs-top').tabs();
      $('#tabs-editor').tabs({
        show: function(event, ui) {
          Simfo.updateGraph(event, ui);
          Simfo.updateButtonNavCenterGraph(event, ui);
        }
      });
      $('#from-entity, #to-entity').combobox({
        updateOptionsList: Simfo.updateOptionsFromEntities,
        change: Simfo.onComboboxChange,
        select: Simfo.onComboboxSelect
      });
      $('#relation').combobox({
        updateOptionsList: Simfo.updateOptionsFromRelations,
        change: Simfo.onComboboxChange,
        select: Simfo.onComboboxSelect
      });
      $('#from-entity-filter, #to-entity-filter').combobox({
        updateOptionsList: Simfo.updateOptionsFromEntities,
        change: Simfo.onComboboxChange,
        select: Simfo.onComboboxSelect
      });
      $('#relation-filter').combobox({
        updateOptionsList: Simfo.updateOptionsFromRelations,
        change: Simfo.onComboboxChange,
        select: Simfo.onComboboxSelect
      });
      $('.ui-combobox').bind( 'keyup', Simfo.onComboboxChange );
      $('.editor-button, .editor-button-bottom').button();
      $('#btn-add').click(Simfo.addRelationTriple);
      $('#btn-delete-selected').click(Simfo.deleteSelected);
      $('#btn-reverse-selected').click(Simfo.addReverseOfSelected);
      $('#btn-nav-link-left').button({
        icons: { primary: "ui-icon-circle-arrow-w" },
        text: false
      }).click(Simfo.navigationLinkLeft);
      $('#btn-nav-link-right').button({
        icons: { primary: "ui-icon-circle-arrow-e" },
        text: false
      }).click(Simfo.navigationLinkRight);
      $('#btn-nav-center-graph').button().click(Simfo.navigationCenterGraphOrTable);
      Simfo.updateButtonNavCenterGraph();
      $('.btn-disabled-unless-row-selected, ' +
        '.btn-disabled-unless-row-or-entity-selected, ' +
        '.btn-disabled-unless-new-data-entered')
        .button( "option", "disabled", true );
      $('#btn-zoom-in').button({
        icons: { primary: "ui-icon-zoomin" },
        text: false
      }).click(Simfo.zoomIn);
      $('#btn-zoom-out').button({
        icons: { primary: "ui-icon-zoomout" },
        text: false
      }).click(Simfo.zoomOut);

      // setup the grid
      $("#tbl-relations").jqGrid({
        ajaxRowOptions: {
          //contentType: "application/json",
          type: 'PUT'
        },
        datatype: 'json',
        colNames:['From Entity ID', 'From Entity', 'Relation ID', 'Relation', 'To Entity ID', 'To Entity', 'Edited At'],
        colModel:[
          { name: 'from_entity_id', index: 'from_entity_id', hidden: true, editable: false },
          { name: 'from_entity__name', index: 'from_entity__name', width: 170, editable: true },
          { name: 'relationship_type_id', index: 'relationship_type_id', hidden: true, editable: false },
          { name: 'relationship_type__name', index: 'relationship_type__name', width: 170, editable: true },
          { name: 'to_entity_id', index: 'to_entity_id', hidden: true, editable: false },
          { name: 'to_entity__name', index: 'to_entity__name', width: 170, editable: true },
          { name: 'updated_at', index: 'updated_at', width: 70, editable: false }
        ],
        gridComplete: function (data) {
          Simfo.dataIsStillFresh('reset');
          Simfo.updateLinkExportCSV();
          $('.btn-disabled-unless-row-selected, ' +
            '.btn-disabled-unless-row-or-entity-selected, ' +
            '.btn-disabled-unless-new-data-entered')
            .button( "option", "disabled", true );
          Simfo.restoreSelectedRow();
        },
        height: '265',
        ignoreCase: true,
        multiselect: false,
        mtype: 'GET',
        ondblClickRow: function(rowId, iRow, iCol, e) {
          $("#tbl-relations").jqGrid('editRow', rowId, true, null, null, 'clientArray', null, Simfo.updateRow);
          Simfo.editingRowId = rowId;
        },
        onSelectRow: Simfo.onSelectRow,
        pager: '#tbl-pager',
        rowNum: 11,
        rowList: [5, 11],
        sortable: true,
        sortname: 'updated_at',
        sortorder: 'desc',
        scroll: false,
        url: '/relationships.json?jqgrid=true',
        width: '760',
        viewrecords: true
      });

      $( "#tbl-relations" ).jqGrid( 'navGrid', '#tbl-pager',
                                    { del: false, add: false, edit: false },
                                    {}, {}, {},
                                    {
                                      multipleSearch: true,
                                      sopt: ['eq','ne','lt','le','gt','ge','bw','bn','ew','en','cn','nc']
                                    });

      $("#tbl-relations").click( function() { Simfo.onGridClick(); });

      // setup the modal form for new categories
      var singular = $( "#singular" ),
        plural = $( "#plural" ),
        allFields = $( [] ).add( singular ).add( plural ),
        tips = $( "#dlg-category-form > .formInstructions" ),
        origTips = tips.text();

      var updateTips = function(t) {
        tips
          .text( t )
          .addClass( "ui-state-highlight" );
        setTimeout(function() {
          tips.removeClass( "ui-state-highlight", 1500 );
        }, 500 );
      };

      var checkCategoryNotExist = function(obj) {
        if ( obj.val().length == 0 || ( obj.val() in Simfo.categories ) ) {
          obj.addClass( "ui-state-error" );
          return false;
        } else {
          return true;
        }
      };

      $( "#dlg-category-form" ).dialog({
        autoOpen: false,
        height: 200,
        width: 300,
        modal: true,
        buttons: {
          "Add Category": function() {
            allFields.removeClass( "ui-state-error" );
            var pluralized = plural.val();
            Simfo.addCategory( singular.val(), plural.val(), function() {
              var rowData = Simfo.pendingAddRowData.pop();
              rowData.relationship['from_entity__category__pluralized_name'] = pluralized;
              Simfo.addRow(rowData);
            });
            $( this ).dialog( "close" );
          },
          Cancel: function() {
            Simfo.addRowCompleted(true);
            $( this ).dialog( "close" );
          }
        },
        close: function() {
          tips.text( origTips );
          allFields.val( "" ).removeClass( "ui-state-error" );
          allFields.val( '' );
        }
      });

    });
