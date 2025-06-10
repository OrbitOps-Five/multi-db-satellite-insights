package com.pramukh.adb.orbitops;


import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class OrbitOpsApplication {

    public static void main(String[] args) {
        SpringApplication.run(OrbitOpsApplication.class, args);

    }

}
