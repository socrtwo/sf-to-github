package com.sf2gh.nativegit;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.eclipse.jgit.api.CloneCommand;
import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.PushCommand;
import org.eclipse.jgit.api.errors.GitAPIException;
import org.eclipse.jgit.lib.Ref;
import org.eclipse.jgit.transport.CredentialsProvider;
import org.eclipse.jgit.transport.PushResult;
import org.eclipse.jgit.transport.RefSpec;
import org.eclipse.jgit.transport.RemoteRefUpdate;
import org.eclipse.jgit.transport.SshSessionFactory;
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider;
import org.eclipse.jgit.transport.sshd.SshdSessionFactoryBuilder;

import java.io.File;
import java.nio.file.Files;
import java.util.Collection;
import java.util.List;

@CapacitorPlugin(name = "NativeGit")
public class NativeGitPlugin extends Plugin {

    @Override
    public void load() {
        // Configure JGit to use Apache MINA SSHD for SSH connections.
        // This enables SSH clone/push without requiring external ssh binaries.
        File sshDir = new File(getContext().getFilesDir(), ".ssh");
        if (!sshDir.exists()) sshDir.mkdirs();

        SshSessionFactory factory = new SshdSessionFactoryBuilder()
                .setPreferredAuthentications("publickey,password")
                .setHomeDirectory(getContext().getFilesDir())
                .setSshDirectory(sshDir)
                .build(null);
        SshSessionFactory.setInstance(factory);
    }

    @PluginMethod
    public void clone(PluginCall call) {
        String url = call.getString("url");
        String dirName = call.getString("dir");
        if (url == null || dirName == null) {
            call.reject("url and dir are required");
            return;
        }

        // Run on background thread to avoid blocking the UI
        getActivity().runOnUiThread(() -> {});
        new Thread(() -> {
            try {
                File dir = new File(getContext().getFilesDir(), dirName);
                if (dir.exists()) {
                    deleteRecursive(dir);
                }

                CloneCommand cmd = Git.cloneRepository()
                        .setURI(url)
                        .setDirectory(dir)
                        .setCloneAllBranches(true)
                        .setMirror(false)
                        .setBare(false);

                // For HTTPS URLs with embedded tokens (https://token@github.com/...)
                // JGit handles them natively. For explicit credentials:
                String username = call.getString("username");
                String password = call.getString("password");
                if (username != null && password != null) {
                    cmd.setCredentialsProvider(
                            new UsernamePasswordCredentialsProvider(username, password));
                }

                notifyProgress(call, "Cloning repository...");
                Git git = cmd.call();
                git.close();

                JSObject result = new JSObject();
                result.put("success", true);
                result.put("dir", dirName);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Clone failed: " + e.getMessage(), e);
            }
        }).start();
    }

    @PluginMethod
    public void push(PluginCall call) {
        String dirName = call.getString("dir");
        String remoteUrl = call.getString("remoteUrl");
        String ref = call.getString("ref");
        String remoteRef = call.getString("remoteRef");
        Boolean force = call.getBoolean("force", false);

        if (dirName == null || remoteUrl == null) {
            call.reject("dir and remoteUrl are required");
            return;
        }

        new Thread(() -> {
            try {
                File dir = new File(getContext().getFilesDir(), dirName);
                Git git = Git.open(dir);

                PushCommand cmd = git.push()
                        .setRemote(remoteUrl)
                        .setForce(force);

                if (ref != null && remoteRef != null) {
                    cmd.setRefSpecs(new RefSpec(ref + ":" + remoteRef));
                } else if (ref != null) {
                    cmd.setRefSpecs(new RefSpec(ref));
                }

                // Support token-based auth for GitHub
                String token = call.getString("token");
                if (token != null) {
                    cmd.setCredentialsProvider(
                            new UsernamePasswordCredentialsProvider(token, ""));
                }

                Iterable<PushResult> results = cmd.call();
                git.close();

                JSObject result = new JSObject();
                result.put("success", true);

                JSArray updates = new JSArray();
                for (PushResult pr : results) {
                    for (RemoteRefUpdate ru : pr.getRemoteUpdates()) {
                        JSObject update = new JSObject();
                        update.put("ref", ru.getSrcRef());
                        update.put("remoteRef", ru.getRemoteName());
                        update.put("status", ru.getStatus().toString());
                        updates.put(update);
                    }
                }
                result.put("updates", updates);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Push failed: " + e.getMessage(), e);
            }
        }).start();
    }

    @PluginMethod
    public void listBranches(PluginCall call) {
        String dirName = call.getString("dir");
        String remote = call.getString("remote"); // null for local, "origin" for remote
        if (dirName == null) {
            call.reject("dir is required");
            return;
        }

        new Thread(() -> {
            try {
                File dir = new File(getContext().getFilesDir(), dirName);
                Git git = Git.open(dir);

                var cmd = git.branchList();
                if ("origin".equals(remote)) {
                    cmd.setListMode(org.eclipse.jgit.api.ListBranchCommand.ListMode.REMOTE);
                }

                List<Ref> refs = cmd.call();
                git.close();

                JSObject result = new JSObject();
                JSArray branches = new JSArray();
                for (Ref ref : refs) {
                    String name = ref.getName();
                    // Strip refs/heads/ or refs/remotes/origin/ prefix for clean names
                    if (name.startsWith("refs/remotes/origin/")) {
                        name = name.substring("refs/remotes/origin/".length());
                    } else if (name.startsWith("refs/heads/")) {
                        name = name.substring("refs/heads/".length());
                    }
                    if (!"HEAD".equals(name)) {
                        branches.put(name);
                    }
                }
                result.put("branches", branches);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("listBranches failed: " + e.getMessage(), e);
            }
        }).start();
    }

    @PluginMethod
    public void listTags(PluginCall call) {
        String dirName = call.getString("dir");
        if (dirName == null) {
            call.reject("dir is required");
            return;
        }

        new Thread(() -> {
            try {
                File dir = new File(getContext().getFilesDir(), dirName);
                Git git = Git.open(dir);
                List<Ref> refs = git.tagList().call();
                git.close();

                JSObject result = new JSObject();
                JSArray tags = new JSArray();
                for (Ref ref : refs) {
                    String name = ref.getName();
                    if (name.startsWith("refs/tags/")) {
                        name = name.substring("refs/tags/".length());
                    }
                    tags.put(name);
                }
                result.put("tags", tags);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("listTags failed: " + e.getMessage(), e);
            }
        }).start();
    }

    @PluginMethod
    public void cleanup(PluginCall call) {
        String dirName = call.getString("dir");
        if (dirName == null) {
            call.reject("dir is required");
            return;
        }

        new Thread(() -> {
            try {
                File dir = new File(getContext().getFilesDir(), dirName);
                if (dir.exists()) {
                    deleteRecursive(dir);
                }
                JSObject result = new JSObject();
                result.put("success", true);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Cleanup failed: " + e.getMessage(), e);
            }
        }).start();
    }

    private void notifyProgress(PluginCall call, String message) {
        JSObject data = new JSObject();
        data.put("message", message);
        notifyListeners("progress", data);
    }

    private void deleteRecursive(File file) {
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursive(child);
                }
            }
        }
        file.delete();
    }
}
