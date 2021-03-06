/*!
 * VisualEditor DataModel MWImageNode class.
 *
 * @copyright 2011-2017 VisualEditor Team and others; see AUTHORS.txt
 * @license The MIT License (MIT); see LICENSE.txt
 */

/**
 * DataModel MediaWiki image node.
 *
 * @class
 * @abstract
 * @extends ve.dm.GeneratedContentNode
 * @mixins ve.dm.FocusableNode
 * @mixins ve.dm.ResizableNode
 *
 * @constructor
 */
ve.dm.MWImageNode = function VeDmMWImageNode() {
	// Parent constructor
	ve.dm.GeneratedContentNode.call( this );

	// Mixin constructors
	ve.dm.FocusableNode.call( this );
	// ve.dm.MWResizableNode doesn't exist
	ve.dm.ResizableNode.call( this );

	this.scalablePromise = null;

	// Use 'bitmap' as default media type until we can
	// fetch the actual media type from the API
	this.mediaType = 'BITMAP';

	// Initialize
	this.constructor.static.syncScalableToType(
		this.getAttribute( 'type' ),
		this.mediaType,
		this.getScalable()
	);

	// Events
	this.connect( this, { attributeChange: 'onAttributeChange' } );
};

/* Inheritance */

OO.inheritClass( ve.dm.MWImageNode, ve.dm.GeneratedContentNode );

OO.mixinClass( ve.dm.MWImageNode, ve.dm.FocusableNode );

OO.mixinClass( ve.dm.MWImageNode, ve.dm.ResizableNode );

/* Static methods */

ve.dm.MWImageNode.static.rdfaToTypes = ( function () {
	var rdfaToType = {};

	[ 'Image', 'Video', 'Audio' ].forEach( function ( mediaClass ) {
		rdfaToType[ 'mw:' + mediaClass ] = { mediaClass: mediaClass, frameType: 'none' };
		rdfaToType[ 'mw:' + mediaClass + '/Frameless' ] = { mediaClass: mediaClass, frameType: 'frameless' };
		// Block image only:
		rdfaToType[ 'mw:' + mediaClass + '/Thumb' ] = { mediaClass: mediaClass, frameType: 'thumb' };
		rdfaToType[ 'mw:' + mediaClass + '/Frame' ] = { mediaClass: mediaClass, frameType: 'frame' };
	} );

	return rdfaToType;
}() );

ve.dm.MWImageNode.static.getRdfa = function ( mediaClass, frameType ) {
	return 'mw:' + mediaClass + {
		none: '',
		frameless: '/Frameless',
		// Block image only:
		thumb: '/Thumb',
		frame: '/Frame'
	}[ frameType ];
};

ve.dm.MWImageNode.static.getHashObject = function ( dataElement ) {
	return {
		type: dataElement.type,
		resource: dataElement.attributes.resource,
		width: dataElement.attributes.width,
		height: dataElement.attributes.height
	};
};

ve.dm.MWImageNode.static.getMatchRdfaTypes = function () {
	return Object.keys( this.rdfaToTypes );
};

ve.dm.MWImageNode.static.allowedRdfaTypes = [ 'mw:Error' ];

ve.dm.MWImageNode.static.describeChanges = function ( attributeChanges, attributes ) {
	var key, sizeFrom, sizeTo, change,
		customKeys = [ 'width', 'height', 'defaultSize', 'src', 'href' ],
		descriptions = [];

	function describeSize( width, height ) {
		return width + ve.msg( 'visualeditor-dimensionswidget-times' ) + height + ve.msg( 'visualeditor-dimensionswidget-px' );
	}

	if ( 'width' in attributeChanges || 'height' in attributeChanges ) {
		if ( attributeChanges.defaultSize && attributeChanges.defaultSize.from === true ) {
			sizeFrom = ve.msg( 'visualeditor-mediasizewidget-sizeoptions-default' );
		} else {
			sizeFrom = describeSize(
				'width' in attributeChanges ? attributeChanges.width.from : attributes.width,
				'height' in attributeChanges ? attributeChanges.height.from : attributes.height
			);
		}
		if ( attributeChanges.defaultSize && attributeChanges.defaultSize.to === true ) {
			sizeTo = ve.msg( 'visualeditor-mediasizewidget-sizeoptions-default' );
		} else {
			sizeTo = describeSize(
				'width' in attributeChanges ? attributeChanges.width.to : attributes.width,
				'height' in attributeChanges ? attributeChanges.height.to : attributes.height
			);
		}

		descriptions.push( ve.msg( 'visualeditor-changedesc-image-size', sizeFrom, sizeTo ) );
	}
	for ( key in attributeChanges ) {
		if ( customKeys.indexOf( key ) === -1 ) {
			if ( key === 'borderImage' && !attributeChanges.borderImage.from && !attributeChanges.borderImage.to ) {
				// Skip noise from the data model
				continue;
			}
			change = this.describeChange( key, attributeChanges[ key ] );
			descriptions.push( change );
		}
	}
	return descriptions;
};

ve.dm.MWImageNode.static.describeChange = function ( key, change ) {
	if ( key === 'align' ) {
		return ve.msg( 'visualeditor-changedesc-align',
			// Messages used:
			// visualeditor-align-widget-left, visualeditor-align-widget-right,
			// visualeditor-align-widget-center, visualeditor-align-widget-default
			ve.msg( 'visualeditor-align-widget-' + change.from ),
			ve.msg( 'visualeditor-align-widget-' + change.to )
		);
	}
	// Parent method
	return ve.dm.Node.static.describeChange.apply( this, arguments );
};

/**
 * Take the given dimensions and scale them to thumbnail size.
 *
 * @param {Object} dimensions Width and height of the image
 * @param {string} [mediaType] Media type 'DRAWING' or 'BITMAP'
 * @return {Object} The new width and height of the scaled image
 */
ve.dm.MWImageNode.static.scaleToThumbnailSize = function ( dimensions, mediaType ) {
	var defaultThumbSize = mw.config.get( 'wgVisualEditorConfig' ).defaultUserOptions.defaultthumbsize;

	mediaType = mediaType || 'BITMAP';

	if ( dimensions.width && dimensions.height ) {
		// Use dimensions
		// Resize to default thumbnail size, but only if the image itself
		// isn't smaller than the default size
		// For svg/drawings, the default wiki size is always applied
		if ( dimensions.width > defaultThumbSize || mediaType === 'DRAWING' ) {
			return ve.dm.Scalable.static.getDimensionsFromValue( {
				width: defaultThumbSize
			}, dimensions.width / dimensions.height );
		}
	}
	return dimensions;
};

/**
 * Translate the image dimensions into new ones according to the bounding box.
 *
 * @param {Object} imageDimensions Width and height of the image
 * @param {Object} boundingBox The limit of the bounding box
 * @return {Object} The new width and height of the scaled image.
 */
ve.dm.MWImageNode.static.resizeToBoundingBox = function ( imageDimensions, boundingBox ) {
	var newDimensions = ve.copy( imageDimensions ),
		scale = Math.min(
			boundingBox.height / imageDimensions.height,
			boundingBox.width / imageDimensions.width
		);

	if ( scale < 1 ) {
		// Scale down
		newDimensions = {
			width: Math.floor( newDimensions.width * scale ),
			height: Math.floor( newDimensions.height * scale )
		};
	}
	return newDimensions;
};

/**
 * Update image scalable properties according to the image type.
 *
 * @param {string} type The new image type
 * @param {string} mediaType Image media type 'DRAWING' or 'BITMAP'
 * @param {ve.dm.Scalable} scalable The scalable object to update
 */
ve.dm.MWImageNode.static.syncScalableToType = function ( type, mediaType, scalable ) {
	var originalDimensions, dimensions,
		defaultThumbSize = mw.config.get( 'wgVisualEditorConfig' ).defaultUserOptions.defaultthumbsize;

	originalDimensions = scalable.getOriginalDimensions();

	// We can only set default dimensions if we have the original ones
	if ( originalDimensions ) {
		if ( type === 'thumb' || type === 'frameless' ) {
			// Set the default size to that in the wiki configuration if
			// 1. The original image width is not smaller than the default
			// 2. If the image is an SVG drawing
			if ( originalDimensions.width >= defaultThumbSize || mediaType === 'DRAWING' ) {
				dimensions = ve.dm.Scalable.static.getDimensionsFromValue( {
					width: defaultThumbSize
				}, scalable.getRatio() );
			} else {
				dimensions = ve.dm.Scalable.static.getDimensionsFromValue(
					originalDimensions,
					scalable.getRatio()
				);
			}
			scalable.setDefaultDimensions( dimensions );
		} else {
			scalable.setDefaultDimensions( originalDimensions );
		}
	}

	// Deal with maximum dimensions for images and drawings
	if ( mediaType !== 'DRAWING' ) {
		if ( originalDimensions ) {
			scalable.setMaxDimensions( originalDimensions );
			scalable.setEnforcedMax( true );
		} else {
			scalable.setEnforcedMax( false );
		}
	} else {
		// EnforcedMax may have previously been set to true
		scalable.setEnforcedMax( false );
	}
	// TODO: Some day, when svgMaxSize works properly in MediaWiki
	// we can add it back as max dimension consideration:
	// mw.config.get( 'wgVisualEditorConfig' ).svgMaxSize
};

/**
 * Get the scalable promise which fetches original dimensions from the API
 *
 * @param {string} filename The image filename whose details the scalable will represent
 * @return {jQuery.Promise} Promise which resolves after the image size details are fetched from the API
 */
ve.dm.MWImageNode.static.getScalablePromise = function ( filename ) {
	// On the first call set off an async call to update the scalable's
	// original dimensions from the API.
	if ( ve.init.platform.imageInfoCache ) {
		return ve.init.platform.imageInfoCache.get( filename ).then( function ( info ) {
			if ( !info || info.missing ) {
				return $.Deferred().reject().promise();
			}
			return info;
		} );
	} else {
		return $.Deferred().reject().promise();
	}
};

/* Methods */

/**
 * Respond to attribute change.
 * Update the rendering of the 'align', src', 'width' and 'height' attributes
 * when they change in the model.
 *
 * @method
 * @param {string} key Attribute key
 * @param {string} from Old value
 * @param {string} to New value
 */
ve.dm.MWImageNode.prototype.onAttributeChange = function ( key, from, to ) {
	if ( key === 'type' ) {
		this.constructor.static.syncScalableToType( to, this.mediaType, this.getScalable() );
	}
};

/**
 * Get the normalised filename of the image
 *
 * @return {string} Filename
 */
ve.dm.MWImageNode.prototype.getFilename = function () {
	// Strip ./ stuff and decode URI encoding
	var resource = this.getAttribute( 'resource' ) || '',
		filename = resource.replace( /^(\.\.?\/)*/, '' );

	return ve.decodeURIComponentIntoArticleTitle( filename, true );
};

/**
 * @inheritdoc
 */
ve.dm.MWImageNode.prototype.getScalable = function () {
	var imageNode = this;
	if ( !this.scalablePromise ) {
		this.scalablePromise = ve.dm.MWImageNode.static.getScalablePromise( this.getFilename() );
		// If the promise was already resolved before getScalablePromise returned, then jQuery will execute the done straight away.
		// So don't just do getScalablePromise( ... ).done because we need to make sure that this.scalablePromise gets set first.
		this.scalablePromise.done( function ( info ) {
			if ( info ) {
				imageNode.getScalable().setOriginalDimensions( {
					width: info.width,
					height: info.height
				} );
				// Update media type
				imageNode.mediaType = info.mediatype;
				// Update according to type
				imageNode.constructor.static.syncScalableToType(
					imageNode.getAttribute( 'type' ),
					imageNode.mediaType,
					imageNode.getScalable()
				);
			}
		} );
	}
	// Mixin method
	return ve.dm.ResizableNode.prototype.getScalable.call( this );
};

/**
 * @inheritdoc
 */
ve.dm.MWImageNode.prototype.createScalable = function () {
	return new ve.dm.Scalable( {
		currentDimensions: {
			width: this.getAttribute( 'width' ),
			height: this.getAttribute( 'height' )
		},
		minDimensions: {
			width: 1,
			height: 1
		}
	} );
};

/**
 * Get symbolic name of media type.
 *
 * Example values: "BITMAP" for JPEG or PNG images; "DRAWING" for SVG graphics
 *
 * @return {string|undefined} Symbolic media type name, or undefined if empty
 */
ve.dm.MWImageNode.prototype.getMediaType = function () {
	return this.mediaType;
};

/**
 * Get RDFa type
 *
 * @return {string} RDFa type
 */
ve.dm.MWImageNode.prototype.getRdfa = function () {
	return this.constructor.static.getRdfa( this.getAttribute( 'mediaClass' ), this.getAttribute( 'type' ) );
};
