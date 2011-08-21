/*
 * Create a combobox in jQuery UI
 *
 * Based on demo code from:
 *   http://jqueryui.com/demos/autocomplete/#combobox
 */
(function( $ ) {
  $.widget( "ui.combobox", {
    options: {
      allowNew: true,
      inputElement: null,
      minLength: 0
    },
    _create: function() {
      var self = this,
        select = this.element.hide(),
        selected = select.children( ":selected" ),
        value = selected.val() ? selected.text() : "";
      var input = ( self.options.inputElement ? self.options.inputElement : $( "<input>" ).insertAfter( select ) );
      input.val( value );
      input.autocomplete({
          delay: 0,
          minLength: self.options.minLength,
          source: function( request, response ) {
            var matcher = new RegExp( $.ui.autocomplete.escapeRegex(request.term), "i" );

            // if using a function to update list, we'll call this asynchronously
            var response_callback = function() {
              input.css("background", "white");
              response( select.children( "option" ).map(function() {
                var text = $( this ).text();
                if ( this.value && ( !request.term || matcher.test(text) ) )
                  return {
                    label: text.replace(
                      new RegExp(
                        "(?![^&;]+;)(?!<[^<>]*)(" +
                        $.ui.autocomplete.escapeRegex(request.term) +
                        ")(?![^<>]*>)(?![^&;]+;)", "gi"
                      ), "<strong>$1</strong>" ),
                    value: text,
                    option: this
                  };
              }) );
            }

            if ( $.isFunction(self.options.updateOptionsList) ) {
              // this is a fix for the fact that .ui-autocomplete-loading seems to be ignored
              input.css("background", "white url(/stylesheets/images/ui-anim_basic_16x16.gif) right center no-repeat");
              self.options.updateOptionsList(request.term, select, response_callback);
            } else {
              response_callback();
            }
          },
          select: function( event, ui ) {
            ui.item.option.selected = true;
            self._trigger( "selected", event, {
              item: ui.item.option
            });
            if ( $.isFunction(self.options.select) ) {
              self.options.select(event, ui);
            }
          },
          change: function( event, ui ) {
            if ( !self.options.allowNew && !ui.item ) {
              var matcher = new RegExp( "^" + $.ui.autocomplete.escapeRegex( $(this).val() ) + "$", "i" ),
                valid = false;
              select.children( "option" ).each(function() {
                if ( this.value.match( matcher ) ) {
                  this.selected = valid = true;
                  return true;
                }
              });
              if ( !valid ) {
                // remove invalid value, as it didn't match anything
                $( this ).val( "" );
                select.val( "" );
                return false;
              }
            }
            self._trigger( "change", event, {
              item: $( this ).val()
            });
          }
        })
        .addClass( "ui-widget ui-widget-content ui-corner-left" )
        .addClass( "ui-combobox");

      input.data( "autocomplete" )._renderItem = function( ul, item ) {
        return $( "<li></li>" )
          .data( "item.autocomplete", item )
          .append( "<a>" + item.label + "</a>" )
          .appendTo( ul );
      };

      $( "<button>&nbsp;</button>" )
        .attr( "tabIndex", -1 )
        .attr( "title", "Show All Items" )
        .insertAfter( input )
        .button({
          icons: {
            primary: "ui-icon-triangle-1-s"
          },
          text: false
        })
        .removeClass( "ui-corner-all" )
        .addClass( "ui-corner-right ui-button-icon" )
        .addClass( "ui-combobox-button")
        .height( input.outerHeight(true) )
        .click(function() {
          // close if already visible
          if ( input.autocomplete( "widget" ).is( ":visible" ) ) {
            input.autocomplete( "close" );
            return;
          }

          // pass empty string as value to search for, displaying all results
          input.autocomplete( "search", "" );
          input.focus();
        });
    }
  });
})( jQuery );
