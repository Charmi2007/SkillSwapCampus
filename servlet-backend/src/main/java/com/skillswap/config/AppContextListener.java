package com.skillswap.config;

import jakarta.servlet.ServletContextEvent;
import jakarta.servlet.ServletContextListener;
import jakarta.servlet.annotation.WebListener;

/**
 * Application lifecycle listener to manage resource initialization and cleanup.
 * Closes the HikariCP connection pool cleanly upon container shutdown.
 */
@WebListener
public class AppContextListener implements ServletContextListener {

    @Override
    public void contextInitialized(ServletContextEvent sce) {
        System.out.println("🚀 [AppContextListener] SkillSwap Campus Java Servlet module initialized.");
    }

    @Override
    public void contextDestroyed(ServletContextEvent sce) {
        System.out.println("🛑 [AppContextListener] SkillSwap Campus Java Servlet module shutting down...");
        DatabaseConfig.shutdown();
    }
}
