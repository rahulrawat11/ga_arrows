window.onload = function()
{
    var graphModel;
    if ( !localStorage.getItem( "graph-diagram-markup" ) )
        {
            graphModel = gd.model();
            graphModel.createNode().x( 0 ).y( 0 );
            save( formatData() );
        }

    var alert_content = ' <div id="alert-messages"> <div class="alert alert-success fade in"> <a class="close" data-dismiss="alert" href="\#" aria-hidden="true"> <div class="glyphicon glyphicon-chevron-down"></div> </a>GraphJSON.io is in experimental Alpha.  e.g. there may be bugs and unexpected behavior.  Please pardon our dust, and don\'t build anything TOO important! </div> </div>'
    
    if ( !localStorage.getItem ( "has-visited-flag") )
        {
            
            $("body").append(alert_content);// "#footer");
        }

    if ( localStorage.getItem( "graph-diagram-style" ) )
        {
            d3.select( "link.graph-style" )
                .attr( "href", localStorage.getItem( "graph-diagram-style" ) );
        }

    graphModel = parseMarkup( localStorage.getItem( "graph-diagram-markup" ) );

    var help_content = " \ <ul class='list-unstyled'>  <li><strong class='text-danger'>Properties:</strong> each property key: value <strong>MUST</strong> contain a ':' and <strong>MUST</strong> be on its own line.</li> \
                            <li><strong>Export:</strong> the graph can be exported as an svg or a GraphJSON document.</li> \
                            <li><strong>Reverse:</strong> to reverse direction of arrows.</li> \
                            <li><strong>Drag to pan:</strong> nodes to the edge of the canvas to pan the graph.</li> \
                            <li><strong>Drag to create multiple relationships:</strong> drag edge of node to existing node to create a new edge.</li> \
                            <li><strong>Save:</strong> colors as well as node and edge data.</li> \
                         </ul>\
                       "
    
    $("#help")
        .popover({
            trigger: "hover focus",
            placement: "left",
            content: help_content,
            html: true,
            delay: { show: 0, hide: 500 }
        });
    
    $("#about").on("click", function(event) {
        $("#about-modal").modal('show');
        });
    $(".about-modal-dismiss").on("click", function(event) {
        $("#about-modal").modal('hide');
    });

    var zoom = d3.behavior.zoom();


    var svg = d3.select("#canvas")
        .append("svg:svg")
        .call(zoom.on("zoom", zoomed))
        .attr("class", "graphdiagram")
        .style("cursor", "pointer")

        //.attr('transform', 'translate(' + 0 + ',' + height / 2  + ') scale(1)');
        //.attr("xmlns", "http://www.w3.org/1999.9/svg")
        //.attr("pointer-events", "all");
    
    //zoom.translate([0, height / 2]).scale(1);
    
    var diagram = gd.diagram()
        .scaling(gd.scaling.centerOrScaleDiagramToFitSvg)
        .overlay(function(layoutModel, view) {
            var nodeOverlays = view.selectAll("circle.node.overlay")
                .data(layoutModel.nodes);

            nodeOverlays.exit().remove();

                nodeOverlays.enter().append("circle")
                .attr("class", "node overlay")
                .call( d3.behavior.drag().on( "drag", drag ).on( "dragend", dragEnd ) )
                .on( "click", editNode);

            nodeOverlays
                .attr("r", function(node) {
                    return node.radius.outside();
                })
                .attr("stroke", "none")
                .attr("fill", "rgba(255, 255, 255, 0)")
                .attr("cx", function(node) {
                    return node.x;
                })
                .attr("cy", function(node) {
                    return node.y;
                });

            var nodeRings = view.selectAll("circle.node.ring")
                .data(layoutModel.nodes);

            nodeRings.exit().remove();

            nodeRings.enter().append("circle")
                .attr("class", "node ring")
                .call( d3.behavior.drag().on( "drag", dragRing ).on( "dragend", dragEnd ) );

            nodeRings
                .attr("r", function(node) {
                    return node.radius.outside() + 5;
                })
                .attr("fill", "none")
                .attr("stroke", "rgba(255, 255, 255, 0)")
                .attr("stroke-width", "10px")
                .attr("cx", function(node) {
                    return node.x;
                })
                .attr("cy", function(node) {
                    return node.y;
                });

            var relationshipsOverlays = view.selectAll("path.relationship.overlay")
                .data(layoutModel.relationships);

            relationshipsOverlays.exit().remove();

            relationshipsOverlays.enter().append("path")
                .attr("class", "relationship overlay")
                .attr("fill", "rgba(255, 255, 255, 0)")
                .attr("stroke", "rgba(255, 255, 255, 0)")
                .attr("stroke-width", "10px")
                .on( "click", editRelationship );

            relationshipsOverlays
                .attr("transform", function(r) {
                    var angle = r.start.model.angleTo(r.end.model);
                    return "translate(" + r.start.model.ex() + "," + r.start.model.ey() + ") rotate(" + angle + ")";
                } )
                .attr("d", function(d) { return d.arrow.outline; } );
        });

    function draw()
    {
        svg
            .data([graphModel])
            .call(diagram);
    }

    function save( data )
    {
        var markup = data['markup'];
        var GraphJSON = data['GraphJSON'];
        
        localStorage.setItem( "graph-diagram-markup", markup );
        localStorage.setItem( "GraphJSON", JSON.stringify( GraphJSON ) );
        localStorage.setItem( "graph-diagram-style", d3.select( "link.graph-style" ).attr( "href" ) );
    }

    var newNode = null;
    var newRelationship = null;

    function findClosestOverlappingNode( node )
    {
        var closestNode = null;
        var closestDistance = Number.MAX_VALUE;

        var allNodes = graphModel.nodeList();

        for ( var i = 0; i < allNodes.length; i++ )
        {
            var candidateNode = allNodes[i];
            if ( candidateNode !== node )
            {
                var candidateDistance = node.distanceTo( candidateNode ) * graphModel.internalScale();
                if ( candidateDistance < 50 && candidateDistance < closestDistance )
                {
                    closestNode = candidateNode;
                    closestDistance = candidateDistance;
                }
            }
        }
        return closestNode;
    }

    function drag()
    {
        var node = this.__data__.model;
        node.drag(d3.event.dx, d3.event.dy);
        diagram.scaling(gd.scaling.growButDoNotShrink);
        draw();
    }

    function zoomed() {
        svg.attr('transform', 'translate(' + d3.event.translate + ')scale(' + d3.event.scale + ')');
    }

    function dragRing()
    {
        var node = this.__data__.model;
        if ( !newNode )
        {
            newNode = graphModel.createNode().x( d3.event.x ).y( d3.event.y );
            newRelationship = graphModel.createRelationship( node, newNode );
        }
        var connectionNode = findClosestOverlappingNode( newNode );
        if ( connectionNode )
        {
            newRelationship.end = connectionNode
        } else
        {
            newRelationship.end = newNode;
        }
        node = newNode;
        node.drag(d3.event.dx, d3.event.dy);
        diagram.scaling(gd.scaling.growButDoNotShrink);
        draw();
    }

    function dragEnd()
    {
        if ( newNode )
        {
            newNode.dragEnd();
            if ( newRelationship && newRelationship.end !== newNode )
            {
                graphModel.deleteNode( newNode );
            }
        }
        newNode = null;
        save( formatData() );
        diagram.scaling(gd.scaling.centerOrScaleDiagramToFitSvgSmooth);
        draw();
    }

    d3.select( "#add_node_button" ).on( "click", function ()
    {
        graphModel.createNode().x( 0 ).y( 0 );
        save( formatData() );
        draw();
    } );

    function onControlEnter(saveChange)
    {
        return function()
        {
            if ( d3.event.ctrlKey && d3.event.keyCode === 13 )
            {
                saveChange();
            }
        }
    }

    function editNode()
    {
        function hideEditor()
        {
            editor.classed("hide", true);
        }

        var editor = d3.select(".nodeeditor");
        editor.classed("hide", false);

        var collapsable = d3.select("#panel");
        collapsable.classed("collapse", false);
        collapsable.classed("in", true);

        var node = this.__data__.model;

        var captionField = editor.select("#sb_node_caption");
        captionField.node().value = node.caption() || "";
        captionField.node().select();

        var propertiesField = editor.select("#sb_node_properties");
        propertiesField.node().value = node.properties().list().reduce(function(previous, property) {
            return previous + property.key + ": " + property.value + "\n";
        }, "");

        var fillColorField = editor.select("#sb_node_fill_color");
        fillColorField.node().value = node.style("background-color");

        var lineColorField = editor.select("#sb_node_line_color");
        lineColorField.node().value = node.style("border-color");

        var captionColorField = editor.select("#sb_node_caption_color");
        captionColorField.node().value = node.caption_color();


        function saveChange()
        {
            node.caption( captionField.node().value );
            node.caption_color( captionColorField.node().value );
            node.properties().clearAll();
            propertiesField.node().value.split("\n").forEach(function(line) {
                var tokens = line.split(/: */);
                if (tokens.length === 2) {
                    var key = tokens[0].trim();
                    var value = tokens[1].trim();
                    if (key.length > 0 && value.length > 0) {
                        node.properties().set(key, value);
                    }
                }
            });
            node.style("background-color", fillColorField.node().value);
            node.style("border-color", lineColorField.node().value);

            save( formatData() );
            draw();
            hideEditor();
        }

        function deleteNode()
        {
            graphModel.deleteNode(node);
            save( formatData() );
            draw();
            hideEditor();
        }

        captionField.on("keypress", onControlEnter(saveChange) );
        propertiesField.on("keypress", onControlEnter(saveChange) );
        fillColorField.on("keypress", onControlEnter(saveChange) );
        lineColorField.on("keypress", onControlEnter(saveChange) );

        editor.select("#sb_node_cancel").on("click", hideEditor);
        editor.select("#sb_node_save").on("click", saveChange);
        editor.select("#sb_node_delete").on("click", deleteNode);
    }

    function editRelationship()
    {
        function hideEditor()
        {
            editor.classed("hide", true);
        }

        var editor = d3.select(".relationshipeditor");
        editor.classed("hide", false);

        var relationship = this.__data__.model;

        var relationshipTypeField = editor.select("#sb_relationship_type");
        relationshipTypeField.node().value = relationship.relationshipType() || "";
        relationshipTypeField.node().select();

        var propertiesField = editor.select("#sb_relationship_properties");
        propertiesField.node().value = relationship.properties().list().reduce(function(previous, property) {
            return previous + property.key + ": " + property.value + "\n";
        }, "");

        var lineColorField = editor.select("#sb_relationship_line_color");
        lineColorField.node().value = relationship.style("background-color");

        function saveChange()
        {
            relationship.relationshipType( relationshipTypeField.node().value );
            relationship.properties().clearAll();
            propertiesField.node().value.split("\n").forEach(function(line) {
                var tokens = line.split(/: */);
                if (tokens.length === 2) {
                    var key = tokens[0].trim();
                    var value = tokens[1].trim();
                    if (key.length > 0 && value.length > 0) {
                        relationship.properties().set(key, value);
                    }
                }
            });
            relationship.style("background-color", lineColorField.node().value);

            save( formatData() );
            draw();
            hideEditor();
        }

        function reverseRelationship()
        {
            relationship.reverse();
            save( formatData() );
            draw();
            hideEditor();
        }

        function deleteRelationship()
        {
            graphModel.deleteRelationship(relationship);
            save( formatData() );
            draw();
            hideEditor();
        }

        relationshipTypeField.on("keypress", onControlEnter(saveChange) );
        propertiesField.on("keypress", onControlEnter(saveChange) );

        editor.select("#sb_relationship_cancel").on("click", hideEditor);
        editor.select("#sb_relationship_save").on("click", saveChange);
        editor.select("#sb_relationship_reverse").on("click", reverseRelationship);
        editor.select("#sb_relationship_delete").on("click", deleteRelationship);
    }

    function formatMarkup()
    {
        var container = d3.select( "body" ).append( "div" );
        gd.markup.format( graphModel, container );
        var markup = container.node().innerHTML;
        markup = markup
            .replace( /<li/g, "\n  <li" )
            .replace( /<span/g, "\n    <span" )
            .replace( /<\/span><\/li/g, "</span>\n  </li" )
            .replace( /<\/ul/, "\n</ul" );
        container.remove();

        return markup;
    }

    function formatGraphJSON()
    {
        var container = d3.select( "body" ).append( "div" );
        gd.markup.format( graphModel, container );
        var GraphJSON = { "nodes": [], "edges": [] };
        var elements = container.selectAll('li')[0];
        
        for (var i = 0, n = elements.length; i < n; i++) {
            var e = elements[i];
            if (e.className == "node") {
                var e_node = {};
                e_node['id'] = e.getAttribute('data-node-id');
                e_node['x'] = e.getAttribute('data-x');
                e_node['y'] = e.getAttribute('data-y');
                e_node['style'] = JSON.parse(e.getAttribute('data-style'));
                if (e.hasChildNodes()) {
                    try {
                        var caption = e.getElementsByClassName('caption')[0].innerHTML;
                    }
                    catch (e) {
                        caption = null;
                    }
                    try {
                        var labels = e.getElementsByClassName('labels')[0].innerHMTL;   
                    }
                    catch (e) {    
                        labels = null;
                    }
                    try {
                        var properties = e.getElementsByClassName('properties')[0].innerHMTL;
                    }
                    catch (e) {
                        properties = null;
                    }
                    e_node['caption'] = caption;
                    e_node['labels'] = labels;
                    e_node['properties'] = properties;
                }
                GraphJSON.nodes.push(e_node);
            }
            if (e.className == "relationship") {
                var e_edge = {};
                e_edge['source'] = e.getAttribute('data-from');
                e_edge['target'] = e.getAttribute('data-to');
                e_edge['style'] = JSON.parse(e.getAttribute('data-style'));
                /* node_type, etc. */
                GraphJSON.edges.push(e_edge);
            }
        }
        container.remove();

        return GraphJSON;
    }

    function formatData()
    {
        var data = {};
        data['markup'] = formatMarkup();
        data['GraphJSON'] = formatGraphJSON();

        return data;
    }

    function bindCheckboxToggleFunctions()
    {
        function toggleNodeCaptions()
        {
            var isHidden = d3.event.target.checked ? true : false;
            d3.selectAll('.nodes.layer .caption').classed("hide", isHidden);
        }
        function toggleNodeProperties()
        {
            var isHidden = d3.event.target.checked ? true : false;
            d3.selectAll('.properties.layer .node-speech-bubble').classed("hide", isHidden);
        }
        function toggleRelationshipProperties()
        {
            var isHidden = d3.event.target.checked ? true : false;
            d3.selectAll('.properties.layer .relationship-speech-bubble').classed("hide", isHidden);
        }
        function toggleRelationshipTypes()
        {
            var isHidden = d3.event.target.checked ? true : false;
            d3.selectAll('.relationships.layer .type').classed("hide", isHidden);
        }

        d3.select('#hide_node_properties').on("click", toggleNodeProperties);
        d3.select('#hide_node_captions').on("click", toggleNodeCaptions);
        d3.select('#hide_relationship_properties').on("click", toggleRelationshipProperties);
        d3.select('#hide_relationship_types').on("click", toggleRelationshipTypes);
    }
    bindCheckboxToggleFunctions();

    function bindColorPickers()
    {
        var colorPickerFieldSelectors = [
            '#sb_node_fill_color',
            '#sb_node_line_color',
            '#sb_relationship_line_color',
            '#sb_node_caption_color'
        ];
        var options = {
            onBeforeShow: function () {
                $(this).ColorPickerSetColor(this.value);
            },
            onSubmit: function(hsb, hex, rgb, el) {
                $(el).val("#" + hex);
                $(el).ColorPickerHide();
            }
        };

        $(colorPickerFieldSelectors.join())
            .ColorPicker(options)
            .bind('keyup', function() {
                $(this).ColorPickerSetColor(this.value);
            });
    }
    bindColorPickers();

    function hideModals()
    {
        $(".modal").modal("hide");
    }

    d3.selectAll( ".btn.cancel" ).on( "click", hideModals );
    d3.selectAll( ".modal" ).on( "keyup", function() { if ( d3.event.keyCode === 27 ) hideModals(); } );
    document.body.addEventListener("keyup", function(e) {
        if ( e.keyCode === 27 ) {
            d3.selectAll('.tool').classed("hide", true);

            // Special case note:
            // Using "display: none" instead of class "hide" since the color picker
            // already toggles its own visibility with this method. (The color
            // picker would not be able to remove the "hide" class itself as it is
            // currently written.)
            d3.selectAll('.colorpicker').style("display", "none");
        }
    }, false);

    function showModal(selector)
    {
        $(selector).modal("show");
    }

    var exportMarkup = function ()
    {
        showModal(".modal.export-markup");

        var markup = formatData();
        d3.select( "textarea.code" )
            .attr( "rows", markup.split( "\n" ).length * 2 )
            .node().value = markup;
    };

    function parseMarkup( markup )
    {
        var container = d3.select( "body" ).append( "div" );
        container.node().innerHTML = markup;
        var model = gd.markup.parse( container.select("ul.graph-diagram-markup") );
        container.remove();
        return model;
    }

    var useMarkupFromMarkupEditor = function ()
    {
        var markup = d3.select( "textarea.code" ).node().value;
        graphModel = parseMarkup( markup );
        save( markup );
        draw();
        hideModals();
    };

    d3.select( "#save_markup" ).on( "click", useMarkupFromMarkupEditor );

    var exportSvg = function ()
    {
        var rawSvg = new XMLSerializer().serializeToString(d3.select("#canvas svg" ).node());
        var svgStartTag = "<svg xmlns=\"http://www.w3.org/2000/svg\"";
        var modifiedSvg = rawSvg.replace( /<svg( [^>]*>)/, svgStartTag + "$1" ).replace(/&nbsp;/g, "\u00A0");
        console.log(modifiedSvg);
        window.open( "data:image/svg+xml;base64," + btoa( modifiedSvg ) );
    };

    var chooseStyle = function()
    {
        showModal(".modal.choose-style");
    };

    // simulate the clicking of a the uri for the downloaded file
    function eventFire(el, etype){
          if (el.fireEvent) {
              (el.fireEvent('on' + etype));
          } else {
              var evObj = document.createEvent('Events');
              evObj.initEvent(etype, true, false);
              el.dispatchEvent(evObj);
          }
        }
        
    var jsonToFile = function(filename) {
        var link = document.createElement("a");
        link.download = filename;
        var text = "data:application/json," + localStorage.GraphJSON;
        link.href = text;
        eventFire(link, "click");
    };

    d3.select("#saveStyle" ).on("click", function() {
        var selectedStyle = d3.selectAll("input[name=styleChoice]" )[0]
            .filter(function(input) { return input.checked; })[0].value;
        d3.select("link.graph-style")
            .attr("href", "style/" + selectedStyle);

        graphModel = parseMarkup( localStorage.getItem( "graph-diagram-markup" ) );
        save(formatData());
        draw();
        hideModals();
    });

    function changeInternalScale() {
        graphModel.internalScale(d3.select("#internalScale").node().value);
        draw();
    }
    d3.select("#internalScale").node().value = graphModel.internalScale();

    d3.select(window).on("resize", draw);
    d3.select("#internalScale" ).on("change", changeInternalScale);
    //d3.select( "#exportMarkupButton" ).on( "click", exportMarkup );
    d3.select( "#exportSvgButton" ).on( "click", exportSvg );
    d3.select( "#exportGraphJSONButton" ).on( "click", function() {
        jsonToFile("GraphJSON");});
    d3.select( "#chooseStyleButton" ).on( "click", chooseStyle );

    d3.selectAll( ".modal-dialog" ).on( "click", function ()
    {
        d3.event.stopPropagation();
    } );

    draw();
};
