

const fs = require('fs'),
    path = require('path'),
    moment = require('moment');



class VersionBump {

    constructor(gc, type, pkg, packagePath, buildJsonPath) {
        this.__gc = gc;
        this.__type = type;
        this.__pkg = pkg;
        this.__packagePath = packagePath;
        this.__buildJsonPath = buildJsonPath;
        gc.addTask(true, 'version-bump', () => {
            this.run();
        });
    }

    get gc() { return this.__gc; }
    get type() { return this.__type; }
    get pkg() { return this.__pkg; }
    get packagePath() { return this.__packagePath; }
    get rc() { return !!this.gc.grunt.option('rc'); }
    get bump() { return !!this.gc.grunt.option('bump'); }
    get noBump() { return !!this.gc.grunt.option('no-bump'); }
    get buildJsonPath() { return this.__buildJsonPath; }

    versionObj(major, minor, hotfix, rc) {
        const obj = [major, minor, hotfix];
        Object.defineProperty(obj, 'rc', {
            configurable: false,
            enumerable: false,
            writable: true,
            value: (typeof (rc) == 'number' ? rc : null)
        });
        return obj;
    }

    parseVersion(versionString) {
        const m = versionString.match(/^([0-9]+)\.([0-9]+)\.([0-9]+)(-rc([1-9][0-9]*))?$/i);
        let rc = null;
        if (!m) {
            this.gc.grunt.fail.warn(`Cannot parse version string from package.json: ${versionString}\nAdd force argument to force 1.0.0.`);
            return this.versionObj(1, 0, 0, null);
        }
        const v = [1, 2, 3].map(index => parseInt(m[index], 10));
        if (m[5]) {
            v.push(parseInt(m[5], 10));
        }
        return this.versionObj(...v);
    }

    bumpVersion() {
        const version = this.parseVersion(`${this.pkg.version}`);
        let index = -1;
        switch (this.type) {
            case 'major' :
                index = 0;
                break;
            case 'minor' :
                index = 1;
                break;
            case 'hotfix' :
                index = 2;
                break;
            default:
                this.gc.grunt.fail.fatal(`Unsupported bump-type: ${this.type}`);
        }
        if (!this.rc && !this.noBump && typeof (version.rc) == 'number') {
            version.rc = null;
        } else if ((this.rc && (!this.bump || typeof (version.rc) != 'number')) || (!this.rc && !this.noBump)) {
            ++version[index];
            for (let i = index + 1; i < 3; ++i) {
                version[i] = 0;
            }
        }
        if (this.rc) {
            if (this.bump || typeof (version.rc) != 'number') {
                version.rc = 1;
            } else {
                ++version.rc;
            }
        } else {
            version.rc = null;
        }
        let v = version.join('.');
        if (typeof (version.rc) == 'number') {
            v += `-rc${version.rc}`;
        }
        return v;
    }

    run() {
        const version = this.bumpVersion();
        this.gc.grunt.log.write(`Writing new version ${version} `);
        try {
            this.pkg.version = version;
            fs.writeFileSync(this.packagePath, JSON.stringify(this.pkg, null, '    '));
            this.gc.grunt.log.ok();
        } catch (error) {
            this.gc.grunt.verbose.error(`Error writing package.json: ${error.stack}`);
            this.gc.grunt.fail.fatal(`Error writing package.json: ${error.message}`);
        }
        if (this.buildJsonPath) {
            this.constructor.writeBuildJSON(this.gc, this.buildJsonPath, version);
        }
    }

    static writeBuildJSON(gc, buildJsonPath, version) {
        try {
            
            if (buildJsonPath) {
                gc.grunt.log.write(`Writing build json `);
                const build = {};
                if (fs.existsSync(this.buildJsonPath)) {
                    Object.assign(build, require(this.buildJsonPath));
                }
                build.version = version;
                build.releaseDate = moment().format('YYYY-MM-DD HH:mm:ss');
                fs.writeFileSync(buildJsonPath, JSON.stringify(build, null, '    '));
            }
        } catch (error) {
            gc.grunt.verbose.error(`Error writing ${buildJsonPath}: ${error.stack}`);
            gc.grunt.fail.fatal(`Error writing ${buildJsonPath}: ${error.stack}`);
        }
    }

    static init(gc, packagePath, buildJsonPath) {
        try {
            const rt = gc.option('versionBump') && gc.releaseMode && gc.grunt.option('release-type');
            if (rt) {
                switch (rt) {
                    case 'major' :
                    case 'minor' :
                    case 'hotfix' : {
                        const pkg = require(packagePath);
                        return new this(gc, rt, pkg, packagePath, buildJsonPath);
                    }
                    default : 
                        throw new Error(`Unsupported version-type, expected major, minor or hotfix.`);
                }
            } else if (buildJsonPath) {
                return (gc.releaseMode ? this.buildJSONProd(gc, packagePath, buildJsonPath) : this.buildJSONDev(gc, buildJsonPath));
            }
        } catch (error) {
            gc.grunt.verbose.error(`Error initializing version-bump: ${error.stack}`);
            gc.grunt.fail.fatal(`Error initializing version-bump: ${error.message}`);
        }
    }

    static buildJSONDev(gc, buildJsonPath) {
        if (buildJsonPath) {
            gc.addTask(true, 'build-json-dev', () => {
                this.writeBuildJSON(gc, buildJsonPath, `dev-${Date.now()}`);
            });
        }
    }

    static buildJSONProd(gc, packagePath, buildJsonPath) {
        if (packagePath && buildJsonPath && fs.existsSync(packagePath)) {
            gc.addTask(true, 'build-json-prod', () => {
                this.writeBuildJSON(gc, buildJsonPath, require(packagePath).version);
            });
        }
    }
}

module.exports = VersionBump;
