package com.skillswap.config;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * Utility to load environment variables from .env files when not set in the host environment.
 */
public class DotenvLoader {

    private static final Map<String, String> ENV_CACHE = new HashMap<>();
    private static boolean loaded = false;

    public static synchronized void load() {
        if (loaded) return;
        loaded = true;

        String[] potentialPaths = {
            ".env",
            "../backend/.env",
            "../../backend/.env",
            "C:\\Users\\DELL\\OneDrive\\SkillSwapCampus\\backend\\.env"
        };

        for (String pathStr : potentialPaths) {
            File file = new File(pathStr);
            if (file.exists() && file.isFile()) {
                try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        line = line.trim();
                        if (line.isEmpty() || line.startsWith("#")) continue;
                        int eq = line.indexOf('=');
                        if (eq > 0) {
                            String key = line.substring(0, eq).trim();
                            String val = line.substring(eq + 1).trim();
                            if ((val.startsWith("\"") && val.endsWith("\"")) ||
                                (val.startsWith("'") && val.endsWith("'"))) {
                                val = val.substring(1, val.length() - 1);
                            }
                            ENV_CACHE.putIfAbsent(key, val);
                        }
                    }
                    System.out.println("✅ [DotenvLoader] Loaded environment variables from: " + file.getAbsolutePath());
                    break;
                } catch (IOException e) {
                    System.err.println("⚠️ [DotenvLoader] Error reading .env: " + e.getMessage());
                }
            }
        }
    }

    public static String get(String key) {
        load();
        String sysEnv = System.getenv(key);
        if (sysEnv != null && !sysEnv.trim().isEmpty()) {
            return sysEnv.trim();
        }
        String sysProp = System.getProperty(key);
        if (sysProp != null && !sysProp.trim().isEmpty()) {
            return sysProp.trim();
        }
        return ENV_CACHE.get(key);
    }

    public static String get(String key, String defaultValue) {
        String val = get(key);
        return (val != null && !val.trim().isEmpty()) ? val : defaultValue;
    }
}
