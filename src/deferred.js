function promiseAWrapper( func, index ) {
	return jQuery.isFunction( func ) && function() {
		var returned;
		try {
			returned = func.apply( this, arguments );
		} catch( e ) {
			return jQuery.Deferred().rejectWith( this, [ e ] );
		}
		return ( index === 1 ) ? jQuery.when( returned ) : returned;
	};
}

function attachToPromise( object, fnDone, fnFail, fnProgress ) {
	if ( object ) {
		if ( jQuery.isFunction( object.promise ) ) {
			object = object.promise();
			object.done( fnDone ).fail( fnFail ).progress( fnProgress );
			return true;
		} else if ( jQuery.isFunction( object.then ) ) {
			object.then( fnDone, fnFail, fnProgress );
			return true;
		}
	}
}

jQuery.extend({

	Deferred: function( func ) {
		var tuples = [
				// action, add listener, listener list, final state
				[ "resolve", "done", jQuery.Callbacks("once memory"), "resolved" ],
				[ "reject", "fail", jQuery.Callbacks("once memory"), "rejected" ],
				[ "notify", "progress", jQuery.Callbacks("memory") ]
			],
			state = "pending",
			promise = {
				state: function() {
					return state;
				},
				always: function() {
					deferred.done( arguments ).fail( arguments );
					return this;
				},
				pipe: pipe,
				then: function( /* fnDone, fnFail, fnProgress */ ) {
					return pipe.apply( this, jQuery.map( core_slice.call(arguments), promiseAWrapper ) );
				},
				// Get a promise for this deferred
				// If obj is provided, the promise aspect is added to the object
				promise: function( obj ) {
					return obj != null ? jQuery.extend( obj, promise ) : promise;
				}
			},
			deferred = {};

		function pipe( /* fnDone, fnFail, fnProgress */ ) {
			var fns = arguments;
			return jQuery.Deferred(function( newDefer ) {
				jQuery.each( tuples, function( i, tuple ) {
					var action = tuple[ 0 ],
						fn = fns[ i ];
					// deferred[ done | fail | progress ] for forwarding actions to newDefer
					deferred[ tuple[1] ]( jQuery.isFunction( fn ) ?
						function() {
							var returned = fn.apply( this, arguments );
							if ( !attachToPromise(
								returned,
								newDefer.resolve,
								newDefer.reject,
								newDefer.notify
							) ) {
								newDefer[ action + "With" ]( this === deferred ? newDefer : this, [ returned ] );
							}
						} :
						newDefer[ action ]
					);
				});
				fns = null;
			}).promise();
		}

		// Add list-specific methods
		jQuery.each( tuples, function( i, tuple ) {
			var list = tuple[ 2 ],
				stateString = tuple[ 3 ];

			// promise[ done | fail | progress ] = list.add
			promise[ tuple[1] ] = list.add;

			// Handle state
			if ( stateString ) {
				list.add(function() {
					// state = [ resolved | rejected ]
					state = stateString;

				// [ reject_list | resolve_list ].disable; progress_list.lock
				}, tuples[ i ^ 1 ][ 2 ].disable, tuples[ 2 ][ 2 ].lock );
			}

			// deferred[ resolve | reject | notify ] = list.fire
			deferred[ tuple[0] ] = list.fire;
			deferred[ tuple[0] + "With" ] = list.fireWith;
		});

		// Make the deferred a promise
		promise.promise( deferred );

		// Call given func if any
		if ( func ) {
			func.call( deferred, deferred );
		}

		// All done!
		return deferred;
	},

	// Deferred helper
	when: function( subordinate /* , ..., subordinateN */ ) {
		var i = 0,
			resolveValues = core_slice.call( arguments ),
			length = resolveValues.length,

			// the count of uncompleted subordinates
			remaining = length !== 1 || subordinate && (
				jQuery.isFunction( subordinate.promise ) ||
				jQuery.isFunction( subordinate.then ) ) ? length : 0,

			// the master Deferred. If resolveValues consist of only a single Deferred, just use that.
			deferred = remaining === 1 ? subordinate : jQuery.Deferred(),

			// Update function for both resolve and progress values
			updateFunc = function( i, contexts, values ) {
				return function( value ) {
					contexts[ i ] = this;
					values[ i ] = arguments.length > 1 ? core_slice.call( arguments ) : value;
					if( values === progressValues ) {
						deferred.notifyWith( contexts, values );
					} else if ( !( --remaining ) ) {
						deferred.resolveWith( contexts, values );
					}
				};
			},

			progressValues, progressContexts, resolveContexts;

		// add listeners to Deferred subordinates; treat others as resolved
		if ( length > 1 ) {
			progressValues = new Array( length );
			progressContexts = new Array( length );
			resolveContexts = new Array( length );
			for ( ; i < length; i++ ) {
				if ( !attachToPromise(
					resolveValues[ i ],
					updateFunc( i, resolveContexts, resolveValues ),
					deferred.reject,
					updateFunc( i, progressContexts, progressValues )
				) ) {
					--remaining;
				}
			}
		}

		// if we're not waiting on anything, resolve the master
		if ( !remaining ) {
			deferred.resolveWith( resolveContexts, resolveValues );
		}

		return deferred.promise ? deferred.promise() : deferred;
	}
});
