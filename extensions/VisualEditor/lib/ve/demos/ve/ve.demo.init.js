/*!
 * VisualEditor standalone demo
 *
 * @copyright 2011-2017 VisualEditor Team and others; see http://ve.mit-license.org
 */

new ve.init.sa.Platform( ve.messagePaths ).getInitializedPromise().done( function () {

	var $toolbar = $( '.ve-demo-targetToolbar' ),
		$editor = $( '.ve-demo-editor' ),
		// eslint-disable-next-line new-cap
		target = new ve.demo.target(),
		hashChanging = false,

		currentLang = ve.init.platform.getUserLanguages()[ 0 ],
		currentDir = target.$element.css( 'direction' ) || 'ltr',
		device = ve.demo.target === ve.init.sa.DesktopTarget ? 'desktop' : 'mobile',

		// Menu widgets
		addSurfaceContainerButton = new OO.ui.ButtonWidget( {
			icon: 'add',
			label: 'Add surface'
		} ),

		languageInput = new ve.ui.LanguageInputWidget( {
			dirInput: 'no-auto',
			hideCodeInput: true,
			availableLanguages: ve.availableLanguages,
			dialogManager: new OO.ui.WindowManager( { factory: ve.ui.windowFactory, classes: [ 've-demo-languageSearchDialogManager' ] } )
		} ),
		deviceSelect = new OO.ui.ButtonSelectWidget().addItems( [
			new OO.ui.ButtonOptionWidget( { data: 'desktop', label: 'Desktop' } ),
			new OO.ui.ButtonOptionWidget( { data: 'mobile', label: 'Mobile' } )
		] );

	// HACK: Prepend a qqx/message keys option to the list
	languageInput.dialogs.on( 'opening', function ( window, opening ) {
		opening.then( function () {
			var searchWidget = languageInput.dialogs.currentWindow.searchWidget;
			searchWidget.filteredLanguageResultWidgets.unshift(
				new ve.ui.LanguageResultWidget( {
					data: {
						code: 'qqx',
						name: 'Message keys',
						autonym: 'Message keys'
					}
				} )
			);
			searchWidget.addResults();
		} );
	} );

	function updateStylesFromDir() {
		var oldDir = currentDir === 'ltr' ? 'rtl' : 'ltr';

		$( '.stylesheet-' + currentDir ).prop( 'disabled', false );
		$( '.stylesheet-' + oldDir ).prop( 'disabled', true );

		$( 'body' ).css( 'direction', currentDir )
			// The following classes can be used here:
			// ve-demo-dir-ltr
			// ve-demo-dir-rtl
			.addClass( 've-demo-dir-' + currentDir )
			.removeClass( 've-demo-dir-' + oldDir );
	}

	// Initialization

	deviceSelect.selectItemByData( device );

	deviceSelect.on( 'select', function ( item ) {
		location.href = location.href.replace( device, item.getData() );
	} );

	languageInput.setLangAndDir( currentLang, currentDir );
	// Dir doesn't change on init but styles need to be set
	updateStylesFromDir();

	languageInput.on( 'change', function ( lang, dir ) {
		if ( dir === currentDir && lang !== 'qqx' && ve.availableLanguages.indexOf( lang ) === -1 ) {
			return;
		}

		$.i18n().locale = currentLang = lang;
		currentDir = dir;

		updateStylesFromDir();
		target.$element.attr( 'lang', currentLang );

		// HACK: Override/restore message functions for qqx mode
		if ( lang === 'qqx' ) {
			ve.init.platform.getMessage = function ( key ) { return key; };
		} else {
			ve.init.platform.getMessage = ve.init.sa.Platform.prototype.getMessage;
		}

		// Re-bind as getMessage may have changed
		OO.ui.msg = ve.init.platform.getMessage.bind( ve.init.platform );

		// HACK: Re-initialize page to load message files
		ve.init.target.teardownToolbar();
		ve.init.platform.initialize().done( function () {
			var i;
			for ( i = 0; i < ve.demo.surfaceContainers.length; i++ ) {
				ve.demo.surfaceContainers[ i ].reload( currentLang, currentDir );
			}
		} );
	} );

	languageInput.setLangAndDir( currentLang, currentDir );

	$toolbar.append(
		$( '<div>' ).addClass( 've-demo-toolbar-commands' ).append(
			addSurfaceContainerButton.$element,
			$( '<span class="ve-demo-toolbar-divider">&nbsp;</span>' ),
			languageInput.$element,
			$( '<span class="ve-demo-toolbar-divider">&nbsp;</span>' ),
			deviceSelect.$element
		)
	);

	$editor.append( target.$element );

	function updateHash() {
		var i, pages = [];
		if ( hashChanging ) {
			return false;
		}
		if ( history.replaceState ) {
			for ( i = 0; i < ve.demo.surfaceContainers.length; i++ ) {
				pages.push( ve.demo.surfaceContainers[ i ].pageMenu.getSelectedItem().getData() );
			}
			history.replaceState( null, document.title, '#!' + pages.join( ',' ) );
		}
	}

	function addSurfaceContainer( page ) {
		var surfaceContainer;

		if ( !page && ve.demo.surfaceContainers.length ) {
			page = ve.demo.surfaceContainers[ ve.demo.surfaceContainers.length - 1 ].pageMenu.getSelectedItem().getData();
		}

		surfaceContainer = new ve.demo.SurfaceContainer( target, page, currentLang, currentDir );
		surfaceContainer.on( 'changePage', updateHash );
		updateHash();
		target.$element.append( surfaceContainer.$element );
	}

	addSurfaceContainerButton.on( 'click', function () {
		addSurfaceContainer();
	} );

	function createSurfacesFromHash( hash ) {
		var i, pages = [];
		if ( /^#!(?:pages|localStorage)\/.+$/.test( hash ) ) {
			pages = hash.slice( 2 ).split( ',' );
		}
		if ( pages.length ) {
			for ( i = 0; i < pages.length; i++ ) {
				addSurfaceContainer( pages[ i ] );
			}
		} else {
			addSurfaceContainer( 'pages/simple.html' );
		}
	}

	createSurfacesFromHash( location.hash );

	$( window ).on( 'hashchange', function () {
		if ( hashChanging ) {
			return;
		}
		hashChanging = true;
		ve.demo.surfaceContainers.slice().forEach( function ( container ) {
			container.destroy();
		} );
		createSurfacesFromHash( location.hash );
		hashChanging = false;
	} );
} );