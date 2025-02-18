# Dev and deploy stategy
My strategy at the moment is to have this vite project called `client`, and to have a node program in the `./src` file compiling to `./dist` as specified by the `tsconfig.json` file. I'm using the `NodeNext` module system ( and specifying `type`: `module` in my `package.json`) so that I can use import/export syntax in the node program. This is nice because that's the module resolution syntax being used by the frontend, too, keeping things unified

# Things to keep an eye on
- In the interest of making sure I am only using one version of typescript, I have removed the typescript version from the client folder and explicitly installed it in the server directory. Since the client seems to work, I think this mean the server and client are effectively relying on the same typescript version. I have also checked that as long as I run tsc through npm, it is relying on the local typescript version, which it is - my global version is 5.5.3, which prints if I just run tsc --version in the console, whereas if I run it through an npm script I get 5.7.3
- Make sure I am using the locally installed typescript by running tsc through an npm script
- Making sure that the tsconfig in the server and client don't get too different - this could cause problems.
- Trying to figure out if I need/need to prevent having two separate typescript installs, one for the server and one for the client.

> Actually, it looks like typescript is ONLY currently installed on the client, which insn't great. Maybe I'm using my global typescript install? Do I have one of this? Man, I hope not.