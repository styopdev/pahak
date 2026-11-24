cmake_minimum_required(VERSION 3.16)
project(pahak VERSION 0.1.0 LANGUAGES C)

include(CTest)

add_library(pahak src/pahak.c)
target_include_directories(pahak PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    $<INSTALL_INTERFACE:include>)
target_compile_features(pahak PUBLIC c_std_17)

if(WIN32)
    set_target_properties(pahak PROPERTIES WINDOWS_EXPORT_ALL_SYMBOLS ON)
endif()

if(NOT MSVC)
    target_link_libraries(pahak PUBLIC m)
endif()

if(BUILD_TESTING)
    add_executable(pahak_tests tests/test_pahak.c)
    target_link_libraries(pahak_tests PRIVATE pahak)
    add_test(NAME pahak_tests COMMAND pahak_tests)
endif()
