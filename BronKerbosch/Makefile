CXX := g++ # (Debian 12.2.0-14) 12.2.0
CXXFLAGS := -O2 -std=c++11

SRC := src/*
OUT := main

.PHONY: all clean run

all: $(OUT)

$(OUT): $(SRC)
	$(CXX) $(CXXFLAGS) -o $@ $^

run: $(OUT)
	./$(OUT)

clean:
	rm -f $(OUT)
