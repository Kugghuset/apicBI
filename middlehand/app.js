'use strict'

var Promise = require('bluebird');
var r = require('rethinkdb');

var db = require('./db');
var config = require('./config');

var models = require('./models/models');

var Interaction = models.models.Interaction;

var _interactions = [];

var _queue = [];

db.init({ db: 'icws' })
.then(models.init)
.then(function () {
    // console.log('Listening for changes in interaction')

    Interaction.filter(
        r.row('isCurrent')
        // .and(r.row('isAbandoned').or(r.row('isCompleted')).not())
    )
    .pluck(['inQueue', 'queueTime', 'correctedQueueTime', 'id', 'isCurrent', 'userName', 'isAbandoned', 'isCompleted'])
    .run(db.conn(), function (err, cursor) {
        if (err) { console.log(err) }
        else if (cursor) {
            cursor.toArray(function (err, items) {
                if (err) {
                    console.log(err);
                } else {
                    _interactions.push.apply(_interactions, items);
                    console.log(_interactions);

                    console.log(_interactions.length)
                }
            });
        }
    })

    Interaction.filter(
        r.row('isCurrent')
    )
    .pluck([
        'inQueue',
        'queueTime',
        'correctedQueueTime',
        'id',
        'isCurrent',
        'userName',
        'isAbandoned',
        'isCompleted'
    ])
    .changes().run(db.conn(), function (err, cursor) {
        if (err) { console.log(err) }
        else if (cursor) {
            cursor.each(function (err, item) {
                if (err) {
                    console.log(err);
                } else {
                    var old = item.old_val;
                    var _new = item.new_val;

                    if (old === null) {
                        _interactions.push(_new);
                        console.log('Item addded!');
                    } else if (_new === null) {
                        _interactions = _interactions.filter(function (_item) {
                            return _item.id !== old.id;
                        });
                        console.log('Item removed!');
                    } else {
                        var _index = _interactions.reduce(function (output, obj, i) {
                            return output === -1 && obj.id === old.id
                                ? i
                                : output;
                        }, -1);

                        console.log('Item updated!');

                        _interactions.splice(_index, 1, _new);
                    }

                    console.log(_new ? _new : old);

                    console.log(_interactions.length)

                }
            })
        }
    })

    // models.models.Interaction.listen(function (err, value) {
    //     if (err) { console.log(err); }
    //     if (value) { console.log(value); }
    // });

    // console.log('Listening for changes in agent')
    // models.models.Agent.listen(function (err, value) {
    //     if (err) { console.log(err); }
    //     if (value) { console.log(value); }
    // });
});