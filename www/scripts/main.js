'use strict'

Vue.use(VueResource);

Vue.filter('date', function (val, format) {
  return !!val
    ? moment(val).format(format)
    : val;
})

var app = new Vue({
  el: '#app-mount',
  data() {
    return {
      users: [],
      interactions: [],
      queueInfo: { id: null, queueTime: 0, queueLength: 0, abandonedLength: 0, completedLength: 0, abandonRate: 0 },
      currentTime: moment().diff(moment().startOf('day'), 'seconds'),
    };
  },
  computed: {
    _availableUsers() {
      return this.users.filter(this.isAvailable);
    }
  },
  methods: {
    isAvailable(user) {
      return [
        user.loggedIn,
        !user.onPhone,
        user.statusName === 'Available',
        user.workgroups.some(function (workgroup) { return !!~['Partner Service', 'CSA'].indexOf(workgroup.name) })
      ].every(function (val) { return val; });
    },
    formatTimer: function (s) {
      var isNegative = s < 0;

      if (isNegative) {
        s = Math.abs(s);
      }

      var seconds = Math.floor(s);
      var minutes = Math.floor(s / 60);
      var hours = Math.floor(s / 60 / 60);
      // var days = Math.floor(ms /  1000 / 60 / 60 / 24);

      return (isNegative ? '-' : '') + [
        ('0' + hours % 24).slice(-2),
        ':',
        ('0' + minutes % 60).slice(-2),
        ':',
        ('0' + seconds % 60).slice(-2),
      ].join('');
    },
    getWorkgroups: function (user) {
      return user.workgroups.map(function (data) { return data.name }).join(', ');
    }
  },
  ready() {
    setInterval(function () {
      /**
       * Get users.
       */
      this.$http.get('/users')
      .then(
        function (response) {
          this.users = response
            .data
            .map(function (user) { return user; })
            .filter(function (user) { return user.loggedIn })
        }, function (err) {
          console.log(err);
        });

        /**
         * Get interactions
         */
        this.$http.get('/interactions')
        .then(
          function (response) {
            this.interactions = (response.data.activeInteractions || [])
              .map(function (interaction) {
                var user = (this.users.filter(function (usr) { return usr.id === interaction.userName; }) || [])[0];

                return Object.assign({}, interaction, { user: user })
              }.bind(this));
          }, function (err) {
            console.log(err);
          });

        this.$http.get('/queue-info')
        .then(
          function (response) {
            this.queueInfo = response.data;

            console.log(JSON.parse(JSON.stringify(this.queueInfo)))

          }, function (err) {
            console.log(err)
          });

      this.currentTime = moment().diff(moment().startOf('day'), 'seconds');

    }.bind(this), 1000);
  },
})