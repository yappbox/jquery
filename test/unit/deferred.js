module( "deferred", {
	teardown: moduleTeardown
});

(function() {

var creations = {
		"": function( fn ) {
			return jQuery.Deferred( fn );
		},
		" - new operator": function( fn ) {
			return new jQuery.Deferred( fn );
		}
	},
	chainingMethods = "pipe then".split(" "),
	promiseGetters = {
		"deferred": function( obj ) {
			return obj;
		},
		"observable": function( obj ) {
			return obj && jQuery.isFunction( obj.promise ) ? {
				promise: obj.promise
			} : obj;
		},
		"thenable": function( obj ) {
			return obj && jQuery.isFunction( obj.then ) ? {
				then: obj.then
			} : obj;
		}
	};

jQuery.each( creations, function( withNew, createDeferred ) {

	test( "jQuery.Deferred" + withNew, function() {

		expect( 22 );

		var defer = createDeferred();

		createDeferred().resolve().done(function() {
			ok( true, "Success on resolve" );
			strictEqual( this.state(), "resolved", "Deferred is resolved (state)" );
		}).fail(function() {
			ok( false, "Error on resolve" );
		}).always(function() {
			ok( true, "Always callback on resolve" );
		});

		createDeferred().reject().done(function() {
			ok( false, "Success on reject" );
		}).fail(function() {
			ok( true, "Error on reject" );
			strictEqual( this.state(), "rejected", "Deferred is rejected (state)" );
		}).always(function() {
			ok( true, "Always callback on reject" );
		});

		createDeferred(function( defer ) {
			ok( this === defer, "Defer passed as this & first argument" );
			this.resolve("done");
		}).done(function( value ) {
			strictEqual( value, "done", "Passed function executed" );
		});

		createDeferred(function( defer ) {
			var promise = defer.promise(),
				func = function() {},
				funcPromise = defer.promise( func );
			strictEqual( defer.promise(), promise, "promise is always the same" );
			strictEqual( funcPromise, func, "non objects get extended" );
			jQuery.each( promise, function( key, value ) {
				if ( !jQuery.isFunction( promise[ key ] ) ) {
					ok( false, key + " is a function (" + jQuery.type( promise[ key ] ) + ")" );
				}
				if ( promise[ key ] !== func[ key ] ) {
					strictEqual( func[ key ], promise[ key ], key + " is the same" );
				}
			});
		});

		jQuery.expandedEach = jQuery.each;
		jQuery.expandedEach( "resolve reject".split(" "), function( _, change ) {
			createDeferred(function( defer ) {
				strictEqual( defer.state(), "pending", "pending after creation" );
				var checked = 0;
				defer.progress(function( value ) {
					strictEqual( value, checked, "Progress: right value (" + value + ") received" );
				});
				for ( checked = 0; checked < 3; checked++ ) {
					defer.notify( checked );
				}
				strictEqual( defer.state(), "pending", "pending after notification" );
				defer[ change ]();
				notStrictEqual( defer.state(), "pending", "not pending after " + change );
				defer.notify();
			});
		});
	});
});


test( "jQuery.Deferred - chainability", function() {

	var defer = jQuery.Deferred();

	expect( 10 );

	jQuery.expandedEach = jQuery.each;
	jQuery.expandedEach( "resolve reject notify resolveWith rejectWith notifyWith done fail progress always".split(" "), function( _, method ) {
		var object = {
			m: defer[ method ]
		};
		strictEqual( object.m(), object, method + " is chainable" );
	});
});

jQuery.each( chainingMethods, function( _, method ) {

	test( "jQuery.Deferred." + method + " - filtering (done)", function() {
	
		expect( 4 );
	
		var value1, value2, value3,
			defer = jQuery.Deferred(),
			piped = defer[ method ](function( a, b ) {
				return a * b;
			});
	
		piped.done(function( result ) {
			value3 = result;
		});
	
		defer.done(function( a, b ) {
			value1 = a;
			value2 = b;
		});
	
		defer.resolve( 2, 3 );
	
		strictEqual( value1, 2, "first resolve value ok" );
		strictEqual( value2, 3, "second resolve value ok" );
		strictEqual( value3, 6, "result of filter ok" );
	
		jQuery.Deferred().reject()[ method ](function() {
			ok( false, method + " should not be called on reject" );
		});
	
		jQuery.Deferred().resolve()[ method ]( jQuery.noop ).done(function( value ) {
			strictEqual( value, undefined, method + " done callback can return undefined/null" );
		});
	});
	
	test( "jQuery.Deferred." + method + " - filtering (fail)", function() {
	
		expect( 4 );
	
		var value1, value2, value3,
			defer = jQuery.Deferred(),
			piped = defer[ method ]( null, function( a, b ) {
				return a * b;
			}),
			redirection = method === "then" ? "done" : "fail";
	
		piped[ redirection ](function( result ) {
			value3 = result;
		});
	
		defer.fail(function( a, b ) {
			value1 = a;
			value2 = b;
		});
	
		defer.reject( 2, 3 );
	
		strictEqual( value1, 2, "first reject value ok" );
		strictEqual( value2, 3, "second reject value ok" );
		strictEqual( value3, 6, "result of filter ok" );
	
		jQuery.Deferred().resolve()[ method ]( null, function() {
			ok( false, method + " should not be called on resolve" );
		});
	
		jQuery.Deferred().reject()[ method ]( null, jQuery.noop )[ redirection ](function( value ) {
			strictEqual( value, undefined, method + " fail callback can return undefined/null" );
		});
	});
	
	test( "jQuery.Deferred." + method + " - filtering (progress)", function() {
	
		expect( 3 );
	
		var value1, value2, value3,
			defer = jQuery.Deferred(),
			piped = defer[ method ]( null, null, function( a, b ) {
				return a * b;
			});
	
		piped.progress(function( result ) {
			value3 = result;
		});
	
		defer.progress(function( a, b ) {
			value1 = a;
			value2 = b;
		});
	
		defer.notify( 2, 3 );
	
		strictEqual( value1, 2, "first progress value ok" );
		strictEqual( value2, 3, "second progress value ok" );
		strictEqual( value3, 6, "result of filter ok" );
	});
	
	jQuery.each( promiseGetters, function( type, promiseGetter ) {
	
		test( "jQuery.Deferred." + method + " - " + type + " (done)", function() {
		
			expect( 3 );
		
			var value1, value2, value3,
				defer = jQuery.Deferred(),
				piped = defer[ method ](function( a, b ) {
					return promiseGetter( jQuery.Deferred(function( defer ) {
						defer.reject( a * b );
					}) );
				});
		
			piped.fail(function( result ) {
				value3 = result;
			});
		
			defer.done(function( a, b ) {
				value1 = a;
				value2 = b;
			});
		
			defer.resolve( 2, 3 );
		
			strictEqual( value1, 2, "first resolve value ok" );
			strictEqual( value2, 3, "second resolve value ok" );
			strictEqual( value3, 6, "result of filter ok" );
		});
		
		test( "jQuery.Deferred." + method + " - " + type + " (fail)", function() {
		
			expect( 3 );
		
			var value1, value2, value3,
				defer = jQuery.Deferred(),
				piped = defer[ method ]( null, function( a, b ) {
					return promiseGetter( jQuery.Deferred(function( defer ) {
						defer.resolve( a * b );
					}) );
				});
		
			piped.done(function( result ) {
				value3 = result;
			});
		
			defer.fail(function( a, b ) {
				value1 = a;
				value2 = b;
			});
		
			defer.reject( 2, 3 );
		
			strictEqual( value1, 2, "first reject value ok" );
			strictEqual( value2, 3, "second reject value ok" );
			strictEqual( value3, 6, "result of filter ok" );
		});
		
		test( "jQuery.Deferred." + method + " - " + type + " (progress)", function() {
		
			expect( 3 );
		
			var value1, value2, value3,
				defer = jQuery.Deferred(),
				piped = defer[ method ]( null, null, function( a, b ) {
					return promiseGetter( jQuery.Deferred(function( defer ) {
						defer.resolve( a * b );
					}) );
				});
		
			piped.done(function( result ) {
				value3 = result;
			});
		
			defer.progress(function( a, b ) {
				value1 = a;
				value2 = b;
			});
		
			defer.notify( 2, 3 );
		
			strictEqual( value1, 2, "first progress value ok" );
			strictEqual( value2, 3, "second progress value ok" );
			strictEqual( value3, 6, "result of filter ok" );
		});
		
	});
		
	test( "jQuery.Deferred." + method + " - context", function() {
	
		expect( 4 );
	
		var context = {};
	
		jQuery.Deferred().resolveWith( context, [ 2 ] )[ method ](function( value ) {
			return value * 3;
		}).done(function( value ) {
			strictEqual( this, context, "custom context correctly propagated" );
			strictEqual( value, 6, "proper value received" );
		});
	
		var defer = jQuery.Deferred(),
			piped = defer[ method ](function( value ) {
				return value * 3;
			});
	
		defer.resolve( 2 );
	
		piped.done(function( value ) {
			strictEqual( this.promise(), piped, "default context gets updated to latest defer in the chain" );
			strictEqual( value, 6, "proper value received" );
		});
	});
	
	jQuery.each( "done|resolve fail|reject progress|notify".split(" "), function( index, elem ) {
		elem = elem.split("|");
		var type = elem[ 0 ],
			resolver = elem[ 1 ];
		test( "jQuery.Deferred." + method + " - exception in " + type + " callback", function() {
			expect( 1 );
			var defer = jQuery.Deferred(),
				callbacks = [],
				piped;
			callbacks[ index ] = function() {
				throw  "hello world";
			};
			piped = defer[ method ].apply( defer, callbacks );
			if ( method === "pipe" ) {
				raises(function() {
					defer[ resolver ]();
				}, "exception thrown" );
			} else {
				piped.fail(function( error ) {
					strictEqual( error, "hello world", "exception caught" );
				});
				defer[ resolver ]();
			}
		});
	});
});

test( "jQuery.when", function() {

	expect( 34 );

	// Some other objects
	jQuery.each({

		"an empty string": "",
		"a non-empty string": "some string",
		"zero": 0,
		"a number other than zero": 1,
		"true": true,
		"false": false,
		"null": null,
		"undefined": undefined,
		"a plain object": {}

	}, function( message, value ) {

		ok(
			jQuery.isFunction(
				jQuery.when( value ).done(function( resolveValue ) {
					strictEqual( this, window, "Context is the global object with " + message );
					strictEqual( resolveValue, value, "Test the promise was resolved with " + message );
				}).promise
			),
			"Test " + message + " triggers the creation of a new Promise"
		);

	} );

	ok(
		jQuery.isFunction(
			jQuery.when().done(function( resolveValue ) {
				strictEqual( this, window, "Test the promise was resolved with window as its context" );
				strictEqual( resolveValue, undefined, "Test the promise was resolved with no parameter" );
			}).promise
		),
		"Test calling when with no parameter triggers the creation of a new Promise"
	);

	var context = {};

	jQuery.when( jQuery.Deferred().resolveWith( context ) ).done(function() {
		strictEqual( this, context, "when( promise ) propagates context" );
	});

	var cache;

	jQuery.each([ 1, 2, 3 ], function( k, i ) {

		jQuery.when( cache || jQuery.Deferred(function() {
				this.resolve( i );
			})
		).done(function( value ) {

			strictEqual( value, 1, "Function executed" + ( i > 1 ? " only once" : "" ) );
			cache = value;
		});

	});
});

jQuery.each( promiseGetters, function( type, promiseGetter ) {
	
	test( "jQuery.when - joined (" + type + ")", function() {
	
		expect( 119 );
	
		var deferreds = {
				value: 1,
				success: jQuery.Deferred().resolve( 1 ),
				error: jQuery.Deferred().reject( 0 ),
				futureSuccess: jQuery.Deferred().notify( true ),
				futureError: jQuery.Deferred().notify( true ),
				notify: jQuery.Deferred().notify( true )
			},
			willSucceed = {
				value: true,
				success: true,
				futureSuccess: true
			},
			willError = {
				error: true,
				futureError: true
			},
			willNotify = {
				futureSuccess: true,
				futureError: true,
				notify: true
			};
	
		jQuery.each( deferreds, function( id1, _defer1 ) {
			var defer1 = promiseGetter( _defer1 );
			jQuery.each( deferreds, function( id2, _defer2 ) {
				var defer2 = promiseGetter( _defer2 ),
					shouldResolve = willSucceed[ id1 ] && willSucceed[ id2 ],
					shouldError = willError[ id1 ] || willError[ id2 ],
					shouldNotify = willNotify[ id1 ] || willNotify[ id2 ],
					expected = shouldResolve ? [ 1, 1 ] : [ 0, undefined ],
					expectedNotify = shouldNotify && [ willNotify[ id1 ], willNotify[ id2 ] ],
					code = id1 + "/" + id2,
					context1 = _defer1 && jQuery.isFunction( _defer1.promise ) ? _defer1 : undefined,
					context2 = _defer2 && jQuery.isFunction( _defer2.promise ) ? _defer2 : undefined;
	
				jQuery.when( defer1, defer2 ).done(function( a, b ) {
					if ( shouldResolve ) {
						deepEqual( [ a, b ], expected, code + " => resolve" );
						strictEqual( this[ 0 ], context1, code + " => first context OK" );
						strictEqual( this[ 1 ], context2, code + " => second context OK" );
					} else {
						ok( false,  code + " => resolve" );
					}
				}).fail(function( a, b ) {
					if ( shouldError ) {
						deepEqual( [ a, b ], expected, code + " => reject" );
					} else {
						ok( false, code + " => reject" );
					}
				}).progress(function( a, b ) {
					deepEqual( [ a, b ], expectedNotify, code + " => progress" );
					strictEqual( this[ 0 ], expectedNotify[ 0 ] ? context1 : undefined, code + " => first context OK" );
					strictEqual( this[ 1 ], expectedNotify[ 1 ] ? context2 : undefined, code + " => second context OK" );
				});
			});
		});
		deferreds.futureSuccess.resolve( 1 );
		deferreds.futureError.reject( 0 );
	});
	
});

})();
