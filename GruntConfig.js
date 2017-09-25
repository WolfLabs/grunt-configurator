/**
 * Grunt Config
 * 
 * Helper that makes grunt configuration easier
 */
const fs = require('fs'),
    path = require('path'),
    resolvePath = (p) => {
        if (typeof p != 'string') {
            return p;
        }
        if (p.substr(0, 1) == '/') {
            return p;
        }
        return path.normalize(path.join(process.cwd(), p));
    },
    VersionBump = require('./VersionBump');

/**
 * @class GruntConfig
 * 
 * 
 */
class GruntConfig {
    /**
     * @constructor
     * @param {Grunt} grunt Grunt instance
     * @param {String} sources path for sources
     * @param {String} dest path for install artifacts
     */
    constructor(grunt, options) {
        
        this.__options = Object.assign({
            src: 'sources',
            dest: 'dist',
            jobs: 'jobs',
            noEnvChange: false,
            versionBump: true,
            packagePath:'package.json',
            buildJson: null,
            disableWatch: false,
            buildJsonPath: null
        }, options || {});
        this.__grunt = grunt;
        this.__config = {};
        this.__watchPaths = [];
        this.__tasks = [];
        this.__defaultTasks = [];
        this.__recentTasks = [];
        
        this.__releaseMode = !!this.grunt.option('release');
        
        this.__src = resolvePath(this.option('src'));
        this.__dest = resolvePath(this.option('dest'));
        this.__jobs = resolvePath(this.option('jobs'));
        this.__pkgPath = this.option('packagePath') ? resolvePath(this.option('packagePath')) : null;

        if (!this.option('noEnvChange') && this.releaseMode) {
            process.env.NODE_ENV = 'production';
        }

        VersionBump.init(this, this.pkgPath, resolvePath(this.option('buildJson')));
    }

    option(name, defaultValue) {
        if (this.__options[name] === void (0)) {
            return ((defaultValue === void (0)) ? null : defaultValue);
        }
        return this.__options[name];
    }

    /**
     * Grunt instance
     * @property grunt
     * @type {Grunt}
     */
    get grunt() { return this.__grunt; }

    /**
     * Path to package.json
     * @property pkgPath
     * @type String
     */
    get pkgPath() {
        return this.__pkgPath;
    }

    /**
     * Package contents
     * @property pkg
     * @type Object
     */
    get pkg() {
        if (!this.__pkg) {
            if (!this.pkgPath) {
                return null;
            }
            this.__pkg = require(this.pkgPath);
        }
        return this.__pkg;
    }

    /**
     * If it is release mode
     * @property releaseMode
     * @type Boolean
     */
    get releaseMode() { return this.__releaseMode; }

    /**
     * Whenever files watching is enabled 
     * 
     * Watch is enabled if it's not releae mode and --no-watch argument has not been specified
     * @property watchEnabled
     * @type Boolean
     */
    get watchEnabled() { return (!this.grunt.option('no-watch') && !this.releaseMode && !this.option('disableWatch')); }

    /**
     * Jobs directory
     * 
     * @property jobsDir
     * @type String
     */
    get jobsDir() { return this.__jobs; }

    /**
     * Build path to source file
     * 
     * @method src
     * @param {...String} args parts of path
     * @return String path to source
     */
    src(...args) {
        return path.join(this.__src, ...args);
    }

    /**
     * Build path to destination file
     * 
     * @method dest
     * @param {...String} args parts of path
     * @return String path to dest
     */
    dest(...args) {
        return path.join(this.__dest, ...args);
    }

    /**
     * Add path to watched paths
     * 
     * @method addWatchPaths
     * @param {...String} paths watch paths
     */
    addWatchPaths(paths, tasks) {
        tasks = tasks || this.__recentTasks;
        this.__watchPaths.push([paths, tasks]);
        this.__recentTasks = [];
    }

    /**
     * Collect jobs from given directory
     * 
     * @method collectJobs
     * @param {String} jobsDir jobs directory
     */
    collectJobs() {
        fs.readdirSync(this.jobsDir).forEach((job) => {
            if (job.match(/^[0-9]+_/) && job.match(/\.js$/)) {
                require(path.join(this.jobsDir, job)).call(null, this); // eslint-disable-line import/no-dynamic-require
            }
        });
    }

    /**
     * Add grunt config
     * 
     * @method addConfig
     * @param {String} type type (e.g. browserify)
     * @param {String} name job name
     * @param {Object} options job options
     */
    addConfig(type, name, options) {
        if (!this.__config[type]) {
            this.__config[type] = {};
        }
        this.__config[type][name] = options;
    }

    /**
     * Add task
     * 
     * @method addTask
     * @param {Bollean} [isDefault] whenever it should be added to default task
     * @param {String} name task name
     * @param {...any} args arguments taken by grunt registerTask
     */
    addTask(isDefault, name, ...args) {
        if (typeof (isDefault) == 'string') {
            args = [name].concat(args);
            name = isDefault;
            isDefault = false;
        }
        if (isDefault) {
            this.__defaultTasks.push(name);
            this.__recentTasks.push(name);
        }
        this.__tasks.push([name, ...args]);
    }

    /**
     * Init grunt
     * 
     * This method runes grunt.initConfig, if it's not release mode and files/paths has been registered for watching it'd also register extra job for grunt-contrib-watch.
     * It'd also run matchdep for grunt-* and load npm tasks.
     * 
     * @method initGrunt
     */
    initGrunt() {
        let addWatch = false;
        if (this.watchEnabled && this.__watchPaths.length && this.__defaultTasks.length) {
            this.__watchPaths.forEach(([files, tasks], index) => {
                this.addConfig('watch', `files-${index}`, {
                    files,
                    tasks
                });
                addWatch = true;
            });
        }
        this.grunt.initConfig(this.__config);
        this.__tasks.forEach(args => this.grunt.registerTask(...args));
        if (this.__defaultTasks.length) {
            const defaultTasks = [].concat(this.__defaultTasks);
            if (addWatch) {
                defaultTasks.push('watch');
            }
            this.grunt.registerTask('default', defaultTasks);
        }
    }
}

module.exports = GruntConfig;
